#!/usr/bin/env python3
"""
png_to_svg.py — векторизация стикер-пака маскота: PNG 1024 → SVG.

Источник: assets/mascot/stickerpack/1024/*.png (мастера с прозрачностью).
Результат: assets/mascot/stickerpack_svg/*.svg — по одному файлу на персонажа.
Размерных подпапок у SVG нет и не нужно: вектор масштабируется сам.

Как это работает: каждый PNG уменьшается до 512 px (LANCZOS — снимает шум
JPEG-подобных градиентов 3D-рендера, вдвое сокращает число узлов и почти не
влияет на итоговую картинку), затем трассируется vtracer в наложенные слои
плоских заливок. Глянцевые градиенты превращаются в мягкие ступени —
на размерах встройки (20–96 px по MASCOT_GUIDE.md) ступени не видны.

Параметры подобраны замером RMSE рендера SVG против исходного PNG:
color_precision=8 / layer_difference=8 держат градиент тела и лица,
filter_speckle=8 выбрасывает одиночные пиксели-артефакты, path_precision=1
округляет координаты до 0.1 px и режет вес файла примерно вдвое.

Запуск:
    pip install pillow vtracer
    python3 "Team Pulse/assets/mascot/tools/png_to_svg.py"
"""

import re
import sys
from pathlib import Path

from PIL import Image
import vtracer

MASCOT = Path(__file__).resolve().parent.parent
SRC_DIR = MASCOT / "stickerpack" / "1024"
OUT_DIR = MASCOT / "stickerpack_svg"

TRACE_SIDE = 512          # во сколько px ужимаем перед трассировкой
NOMINAL_SIDE = 1024       # width/height в готовом SVG — как у мастера

TRACE_OPTS = dict(
    colormode="color",
    hierarchical="stacked",
    mode="spline",
    color_precision=8,
    layer_difference=8,
    filter_speckle=8,
    path_precision=1,
)

HEADER = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    "<!-- {name}.svg — маскот «Пульс», TeamPulse.\n"
    "     Сгенерировано assets/mascot/tools/png_to_svg.py из\n"
    "     assets/mascot/stickerpack/1024/{name}.png. Правки вносить в PNG-мастер\n"
    "     и перегенерировать, а не редактировать этот файл руками. -->\n"
)


def tidy(svg: str, name: str) -> str:
    """Чистим вывод vtracer: пустые пути, лишние transform, добавляем viewBox."""
    svg = re.sub(r'<path d="" [^>]*/>\n?', "", svg)
    svg = svg.replace(' transform="translate(0,0)"', "")
    svg = re.sub(
        r'<svg version="1.1" xmlns="[^"]*" width="\d+" height="\d+">',
        '<svg xmlns="http://www.w3.org/2000/svg" width="{n}" height="{n}" '
        'viewBox="0 0 {t} {t}" fill="none">'.format(n=NOMINAL_SIDE, t=TRACE_SIDE),
        svg,
    )
    body = svg.split("\n", 1)[1]                      # выкидываем старый XML-пролог
    body = body.split("<svg", 1)[1]                   # и комментарий генератора
    return HEADER.format(name=name) + "<svg" + body


def convert(png: Path, tmp_dir: Path) -> Path:
    name = png.stem
    small = tmp_dir / f"{name}_{TRACE_SIDE}.png"
    with Image.open(png) as im:
        im.convert("RGBA").resize((TRACE_SIDE, TRACE_SIDE), Image.LANCZOS).save(small)

    raw = tmp_dir / f"{name}_raw.svg"
    vtracer.convert_image_to_svg_py(str(small), str(raw), **TRACE_OPTS)

    out = OUT_DIR / f"{name}.svg"
    out.write_text(tidy(raw.read_text(encoding="utf-8"), name), encoding="utf-8")
    return out


def main() -> int:
    sources = sorted(SRC_DIR.glob("*.png"))
    if not sources:
        print(f"нет исходников в {SRC_DIR}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_dir = OUT_DIR / ".tmp"
    tmp_dir.mkdir(exist_ok=True)
    try:
        for png in sources:
            out = convert(png, tmp_dir)
            print(f"{png.name:20s} → {out.name:20s} {out.stat().st_size / 1024:7.1f} KB")
    finally:
        for f in tmp_dir.iterdir():
            f.unlink()
        tmp_dir.rmdir()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
