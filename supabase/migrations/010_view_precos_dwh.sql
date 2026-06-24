-- Migrations 010: View para facilitar a consulta de preços via DWH
-- A relação é feita concatenando ov e item_ov para bater com chave_representante_ov

CREATE OR REPLACE VIEW public.vw_precos_dwh AS
SELECT 
    fof.material AS produto_codigo,
    fpc.preco_zpr0 AS preco_tabela,
    fpc.cod_tipo_list_precos
FROM public.f_ordem_faturamento fof
JOIN public.f_preco_condicao fpc 
  ON fof.chave_representante_ov = (fpc.ov || fpc.item_ov)
WHERE fpc.cod_tipo_list_precos = 'Z3';

-- Definir permissão de leitura para a view
GRANT SELECT ON public.vw_precos_dwh TO authenticated;
GRANT SELECT ON public.vw_precos_dwh TO anon;
