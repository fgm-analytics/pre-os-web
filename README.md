# Dashboard de Performance Comercial - Web App

## 🎯 Objetivo e Especificações do Projeto

Este projeto tem como objetivo migrar a planilha de performance comercial (FGM) para um web app executivo moderno. O sistema visa reproduzir com extrema fidelidade os totais da planilha original, oferecendo uma experiência de análise visual superior, de alta performance e acessível.

**Stack Tecnológica:**

- **Frontend:** Next.js / React (TypeScript, TailwindCSS)
- **Backend:** Node.js/FastAPI (a definir camada de API)
- **Banco de Dados:** PostgreSQL (ODS de Réplica Local)
- **Cache:** Redis para agregados e ganhos de performance.

## 🔗 Integrações

O projeto integra dados de múltiplas fontes para garantir a consistência das visões comerciais:

1. **Salesforce Marketing Cloud (SFMC):** Sincronização de tabelas de Vendedores e Clientes.
2. **Data Warehouse (DWH):** Extração do histórico de faturamento e de performance, limitando a importação às tabelas essenciais (`f_meta`, `f_ordem_faturamento`, `f_shelf_life`).

*Nota:* As rotinas de extração (ETL) estão sendo desenvolvidas em Python (ex: `sync_sfmc.py`) para popular o PostgreSQL local.

## 🚀 Status e O Que Está Pendente

**O que já foi feito / em andamento:**

- Inicialização do repositório Git e backup na nuvem.
- Script de integração SFMC/DWH (`sync_sfmc.py`) em fase de testes e otimização para ambiente de produção.
- Diagnósticos de clientes faltantes e documentação de integração de produtos.

**O que está pendente (Backlog Imediato):**

- **ETL:** Finalizar o script `sync_sfmc.py` com suporte robusto a execuções em produção (variáveis de ambiente, fallback local, logs).
- **Shelf-life:** Resolver o problema na branch `shelf-life` em relação à automação da tabela de preços.
- **Banco de Dados:** Criar migrations SQL para o schema local (PostgreSQL), incluindo as tabelas `f_meta`, `f_ordem_faturamento` e views materializadas.
- **Backend:** Desenvolver as rotas mínimas de API (`/api/vendedores`, `/api/clientes`, `/api/performance/faturamento`, etc.) conforme contrato no `AGENTS.md`.
- **Frontend:** Implementar o design premium do dashboard (Tabelas mensais, Cards trimestrais, Gráficos) consumindo a nova API, aplicando os temas claro/escuro.
- **Validação de Dados (QA):** Implementar testes rigorosos para garantir que os números de atingimento (realizado / meta) e agregados mensais/anuais batam perfeitamente com a planilha original.

---
*Para regras de cálculo detalhadas, arquitetura de agentes e contratos de API, consulte o arquivo [AGENTS.md](../AGENTS.md) na raiz do projeto.*

Criado por Sean Quadros
