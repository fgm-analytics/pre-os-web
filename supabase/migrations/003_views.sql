-- Migrations 003: Views for FGM Performance Dashboard

-- 1. View for historical billing summary grouped by vendedor, ano, mes
CREATE OR REPLACE VIEW public.v_hist_vendedor WITH (security_invoker = true) AS
SELECT 
    vendedor_code,
    vendedor_nome,
    ano,
    mes,
    SUM(realizado_faturamento) AS realizado_faturamento,
    SUM(realizado_volume) AS realizado_volume
FROM public.historico_faturamento
GROUP BY vendedor_code, vendedor_nome, ano, mes;

-- 2. View for historical billing summary grouped by cliente, ano
CREATE OR REPLACE VIEW public.v_hist_cliente WITH (security_invoker = true) AS
SELECT 
    vendedor_code,
    cliente_code,
    cliente_nome,
    ano,
    SUM(realizado_faturamento) AS realizado_faturamento,
    SUM(realizado_volume) AS realizado_volume
FROM public.historico_faturamento
GROUP BY vendedor_code, cliente_code, cliente_nome, ano;

-- 3. View for quarterly performance aggregation (2026)
CREATE OR REPLACE VIEW public.v_perf_trimestral WITH (security_invoker = true) AS
SELECT 
    vendedor_code,
    vendedor_nome,
    subgrupo,
    -- Trimestre calculation (T1 = Jan-Mar, T2 = Apr-Jun, T3 = Jul-Sep, T4 = Oct-Dec)
    CASE 
        WHEN mes IN (1, 2, 3) THEN 1
        WHEN mes IN (4, 5, 6) THEN 2
        WHEN mes IN (7, 8, 9) THEN 3
        WHEN mes IN (10, 11, 12) THEN 4
    END AS trimestre,
    SUM(meta_faturamento) AS meta_faturamento,
    SUM(realizado_faturamento) AS realizado_faturamento,
    SUM(meta_volume) AS meta_volume,
    SUM(realizado_volume) AS realizado_volume,
    -- Atingimento is calculated dynamically (with safe null division)
    CASE 
        WHEN SUM(meta_faturamento) IS NULL OR SUM(meta_faturamento) = 0 THEN NULL
        ELSE SUM(realizado_faturamento) / SUM(meta_faturamento)
    END AS atingimento_faturamento,
    CASE 
        WHEN SUM(meta_volume) IS NULL OR SUM(meta_volume) = 0 THEN NULL
        ELSE SUM(realizado_volume) / SUM(meta_volume)
    END AS atingimento_volume
FROM public.performance_vendedor_2026
GROUP BY 
    vendedor_code, 
    vendedor_nome, 
    subgrupo,
    CASE 
        WHEN mes IN (1, 2, 3) THEN 1
        WHEN mes IN (4, 5, 6) THEN 2
        WHEN mes IN (7, 8, 9) THEN 3
        WHEN mes IN (10, 11, 12) THEN 4
    END;
