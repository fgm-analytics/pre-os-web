# Dashboard de Performance Comercial - Web App

## 🎯 Objetivo e Especificações do Projeto

Este projeto tem como objetivo migrar a planilha de performance comercial (FGM) para um web app executivo moderno. O sistema visa reproduzir com extrema fidelidade os totais da planilha original, oferecendo uma experiência de análise visual superior, de alta performance e acessível.

**Stack Tecnológica:**
- **Frontend:** Next.js / React (TypeScript, TailwindCSS)
- **Backend:** Node.js/FastAPI (a definir camada de API) e API Routes (Next.js)
- **Banco de Dados:** PostgreSQL (Supabase / Réplica Local ODS)
- **Cache:** Redis para agregados e ganhos de performance.

## 🚀 Status e O Que Já Foi Feito

Até o momento, as seguintes etapas foram concluídas na construção da aplicação:
- **Configuração Inicial e Repositório:** Setup do projeto base utilizando Next.js e TypeScript, integrado com TailwindCSS.
- **Pipeline de Integração de Dados:** Desenvolvimento e teste de scripts ETL robustos (Python) para importação de planilhas CSV e tabelas DWH/SFMC para o banco de dados.
- **Banco de Dados:** Criação do schema no PostgreSQL com as tabelas de negócio (`f_ordem_faturamento`, `f_meta`, etc).
- **Interface Gráfica (Web App):** Implementação do design premium (dark/light mode) do dashboard, criando diversas abas focadas na experiência comercial, como Performance, Preços e Segregados.
- **Testes e Segurança:** Realizadas auditorias de segurança e estabilização das rotinas locais.

## 🔄 Scripts de ETL Essenciais para Integração

As integrações de dados são o coração deste sistema, alimentando as dashboards com dados reais e sincronizando tudo diretamente para o **Supabase** (que hospeda nosso PostgreSQL). Os scripts estão localizados na pasta `agents/etl/` e na raiz do projeto.

### 1. `sync_sfmc.py` e `force_supabase_sync.ts`
**O que fazem:** São os scripts responsáveis por puxar os dados do Salesforce Marketing Cloud (SFMC) e persistir diretamente no Supabase. 
- O script em Python (`sync_sfmc.py`) é mais voltado para cargas massivas, cruzando informações como tabela de faturamento (`f_ordem_faturamento`), metas (`f_meta`), clientes e vendedores.
- O script em TypeScript (`force_supabase_sync.ts`) é desenhado para rodar via CLI/Cron de forma automatizada, puxando as "Data Extensions" do SFMC e realizando upsert via Supabase Admin Client.

### 2. `sync_shelf_life_dwh.py`
**O que faz:** Script focado em sincronizar dados críticos de prateleira / validade (Shelf-Life) direto do Data Warehouse (DWH). Ele garante que as informações referentes aos estoques de produtos que estão próximos do vencimento ou possuem campanhas específicas de Shelf-Life sejam importadas, suportando abas específicas do painel comercial.

## 📊 Estrutura e Funcionamento das Abas (Páginas)

O painel foi desenhado para facilitar a vida do executivo/vendedor, quebrando as informações em páginas focadas. A seguir o que cada aba faz:

- **Visão Geral (`/`)**: Página de entrada (Dashboard Principal). Traz um resumo rápido com cartões agregados do mês e semestre.
- **Performance Geral (`/performance`)**: Aba mãe que agrega a visão consolidada de desempenho das vendas da equipe.
  - **Faturamento (`/performance/faturamento`)**: Analisa o faturamento líquido e bruto versus a meta de cada vendedor/região, permitindo entender o nível de "atingimento".
  - **Variação (`/performance/variacao`)**: Demonstra a evolução ou queda percentual das vendas quando comparadas a períodos anteriores (MoM, YoY).
  - **Valores Clientes/Produtos (`/performance/valores-clientes-produtos`)**: Foca na rentabilidade por cliente ou giro de produto. Útil para identificar quais clientes geram mais retorno e quais produtos compõem a curva A.
  - **Últimos Pedidos (`/performance/ultimos-pedidos`)**: Feed focado nos dados transacionais. Lista em detalhes os registros de faturamento e vendas recém importados.
- **Preços e Promoções (`/precos`)**: Renderiza a tabela de preços oficial do trimestre (ex: Tabela do 2º Trimestre) e promoções ativas, servindo como guia rápido de consulta comercial e elaboração de propostas.
- **Segregados (`/segregados`)**: Exibe as informações de vendas e linhas de negócio que não compõem as metas padrão ou que precisam de um acompanhamento apartado (segregado da performance geral).
- **Catálogo / Admin (`/admin/catalogo`)**: Área de consulta e gerenciamento do catálogo de produtos, listando classificações, grupos e subgrupos da base FGM.

---
*Para regras de cálculo detalhadas, arquitetura de agentes e contratos de API, consulte o arquivo [AGENTS.md](../AGENTS.md) na raiz do projeto.*
