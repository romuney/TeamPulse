-- ============================================================================
-- 0к. Точный срез «Структуры численности»: сколько комбинаций атрибутов (поставка 57, подготовка).
-- Helicopter, параграф gp. Ответ — в чат: только счёт людей и комбинаций, без людей и без названий.
--
-- Зачем. Вкладка «Структура» по файлу «Структура» пересчитывает все разрезы по клику (срез). Сейчас
-- в отчёт едут только одномерные разбивки юнита, и пересечения («сколько женщин среди Senior»)
-- оцениваются по долям. Точный срез — таблица состава в ноутбуке: на каждый юнит — число людей по
-- каждой комбинации атрибутов и сумма возрастов (для среднего возраста). Тогда срез считается в
-- отчёте сразу и до человека. Запрос меряет, сколько строк это даст.
--
-- Атрибуты комбинации — те, что есть на вкладке: сеньорность, грейд, стаж (до 1 года / 1–3 / больше
-- 3), пол, возраст (до 25 / 25–30 / 30+), стрим, специализация, компания (юрлицо 1 уровня), тип
-- занятости, формат работы, плюс фильтры отчёта: тип активности, покраска, IT-код.
--
-- Строки ответа:
--   вся компания                      — люди и комбинации на дату данных;
--   юнит N уровня: максимум / среднее — по юнитам 2–4 уровня управленческой структуры;
--   строк таблицы: все юниты          — сколько строк ляжет в таблицу состава (все юниты всех уровней).
-- Дата — последняя в дневной витрине за 10 дней; уволенные в этот день не считаются.
-- ============================================================================
with dt as (
    select max(calendar_dt)::date as d
    from usr_cross_data.hr_executive_proteus
    where calendar_dt >= current_date - 10
),
p as (
    select x.lvl1_mapped_management_unit_rk::text as u1, x.lvl2_mapped_management_unit_rk::text as u2,
           x.lvl3_mapped_management_unit_rk::text as u3, x.lvl4_mapped_management_unit_rk::text as u4,
           x.lvl5_mapped_management_unit_rk::text as u5, x.lvl6_mapped_management_unit_rk::text as u6,
           x.lvl7_mapped_management_unit_rk::text as u7, x.lvl8_mapped_management_unit_rk::text as u8,
           x.lvl9_mapped_management_unit_rk::text as u9, x.lvl10_mapped_management_unit_rk::text as u10,
           x.lvl11_mapped_management_unit_rk::text as u11,
           concat_ws('|',
               coalesce(x.seniority::text, ''), coalesce(x.grade::text, ''),
               case when x.experience_year_amt is null then '' when x.experience_year_amt < 1 then 't0'
                    when x.experience_year_amt < 3 then 't1' else 't3' end,
               coalesce(x.gender::text, ''),
               case when x.age is null then '' when x.age < 25 then 'a0' when x.age < 30 then 'a25' else 'a30' end,
               coalesce(x.employee_stream_desc::text, ''), coalesce(x.employee_specialization_desc::text, ''),
               coalesce(x.lvl1_legal_unit_nm::text, ''), coalesce(x.employment_relation_type_desc::text, ''),
               coalesce(x.employee_contract_type_desc::text, ''), coalesce(x.active_type_nm::text, ''),
               coalesce(x.emp_specialization_oper_code::text, ''), coalesce(x.emp_specialization_it_code::text, '')) as k
    from usr_cross_data.hr_executive_proteus x
    where x.calendar_dt = (select d from dt)
      and coalesce(x.fire_flg::text, '0') <> '1'
),
lv as (
    -- человек — в юните каждого своего уровня
              select 1 as l, u1 as u, k from p where coalesce(u1, '') <> ''
    union all select 2, u2, k from p where coalesce(u2, '') <> ''
    union all select 3, u3, k from p where coalesce(u3, '') <> ''
    union all select 4, u4, k from p where coalesce(u4, '') <> ''
    union all select 5, u5, k from p where coalesce(u5, '') <> ''
    union all select 6, u6, k from p where coalesce(u6, '') <> ''
    union all select 7, u7, k from p where coalesce(u7, '') <> ''
    union all select 8, u8, k from p where coalesce(u8, '') <> ''
    union all select 9, u9, k from p where coalesce(u9, '') <> ''
    union all select 10, u10, k from p where coalesce(u10, '') <> ''
    union all select 11, u11, k from p where coalesce(u11, '') <> ''
),
per as (
    select l, u, count(*) as people, count(distinct k) as combos from lv group by l, u
)
select 0 as n, 'вся компания' as part, (select count(*) from p) as people, (select count(distinct k) from p) as combos
union all
select l * 10 + 1, 'юнит ' || l || ' уровня: максимум', max(people), max(combos) from per where l between 2 and 4 group by l
union all
select l * 10 + 2, 'юнит ' || l || ' уровня: среднее', round(avg(people)), round(avg(combos)) from per where l between 2 and 4 group by l
union all
select 99, 'строк таблицы: все юниты всех уровней', sum(people), sum(combos) from per
order by 1;
