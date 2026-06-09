# Plataforma de Pedidos Comerciais FGM - Planejamento de Implementação (MVP)

## Objetivo

Desenvolver uma plataforma web interna para apoio à força de vendas da FGM, permitindo a montagem de pedidos a partir dos portfólios Dentscare, Home_Care e Whiteness.

A primeira versão terá foco em validação operacional e adoção pelos vendedores, sem implementação de autenticação SSO Microsoft ou restrição de acesso por IP.

O sistema deverá permitir administração centralizada de preços, montagem de pedidos, importação/exportação de planilhas e geração de pedidos compatíveis com o processo atual de importação no Salesforce.

Como Dentscare, Home_Care e Whiteness representam unidades de negócio distintas, os pedidos deverão ser tratados de forma independente por aba. O comportamento padrão da plataforma será trabalhar com pedidos separados por unidade de negócio.

---

# Escopo do MVP

## Estrutura da Aplicação

A plataforma deverá possuir três abas principais:

* Dentscare
* Home_Care
* Whiteness

Cada aba deverá carregar automaticamente os produtos a partir dos respectivos arquivos JSON.

### Regras de Exibição

* Manter a mesma ordem dos produtos presente no JSON.
* Exibir o nome do produto utilizando a cor definida no atributo `cor`.
* Exibir todos os produtos da respectiva linha de negócio.
* Preservar código, nome e categoria conforme cadastro dos arquivos fonte.
* Cada aba deverá manter seu próprio contexto de pedido.
* As operações de copiar pedido deverão considerar apenas os itens da aba atualmente selecionada.

---

# Perfis de Usuário

## Administrador

Responsável por:

* Gerenciar tabela de preços.
* Importar preços via Excel.
* Exportar tabela de preços.
* Atualizar preços manualmente.
* Disponibilizar preços atualizados para todos os vendedores.

## Vendedor

Responsável por:

* Consultar produtos.
* Montar pedidos.
* Aplicar descontos.
* Informar bonificações.
* Exportar pedidos.
* Copiar pedidos para utilização no Salesforce.

---

# Estrutura da Tabela de Produtos

## Visão do Vendedor

| Campo             | Tipo            |
| ----------------- | --------------- |
| Código            | Somente leitura |
| Produto           | Somente leitura |
| Categoria         | Somente leitura |
| Preço Tabela (R$) | Somente leitura |
| Quantidade        | Editável        |
| Desconto (%)      | Editável        |
| Bonificados (Qtd) | Editável        |

### Regras

* O preço tabela será carregado automaticamente da tabela administrada pelo perfil Administrador.
* O vendedor não poderá alterar preços.
* Quantidade, desconto e bonificados poderão ser alterados livremente.

---

# Administração de Preços

## Tela de Gestão de Preços

Tabela administrativa:

| Código     | Produto | Preço Tabela |
| ---------- | ------- | ------------ |
| 4000030171 | Produto | R$ 125,00    |

### Funcionalidades

* Importar Excel.
* Exportar Excel.
* Editar preços individualmente.
* Salvar alterações.

---

## Importação de Preços

### Layout Esperado

| codigo     | preco_tabela |
| ---------- | ------------ |
| 4000030171 | 125,00       |
| 4000030172 | 89,50        |

### Regras

* Código será utilizado como identificador único.
* Atualizar preços existentes.
* Exibir inconsistências para códigos não encontrados.

---

## Exportação de Preços

Gerar arquivo Excel contendo todos os campos disponíveis na tela de administração de preços, permitindo backup completo e reimportação da configuração da plataforma.

Layout de exportação:

| codigo | produto | categoria | preco_tabela | quantidade | desconto | bonificados |
| ------ | ------- | --------- | ------------ | ---------- | -------- | ----------- |

---

# Funcionalidades do Pedido

## Montagem de Pedido

O vendedor poderá:

* Informar quantidade.
* Aplicar desconto percentual.
* Informar quantidade bonificada.

Cada aba deverá manter seus próprios itens e quantidades, permitindo que o vendedor monte pedidos independentes para cada unidade de negócio.

---

## Importação de Pedido

Permitir carregamento de arquivo Excel.

### Layout Esperado

O arquivo poderá conter colunas adicionais além das utilizadas pelo sistema. As colunas obrigatórias para importação são:

| codigo | quantidade | desconto | bonificados |
| ------ | ---------- | -------- | ----------- |

Exemplos de colunas adicionais que poderão estar presentes e serão ignoradas durante a importação:

* produto
* preco_tabela
* categoria
* aba

A identificação dos itens será realizada exclusivamente pelo campo `codigo`. Colunas não reconhecidas não deverão gerar erro e serão simplesmente desconsideradas pelo sistema.

### Regras

* Código utilizado como identificador do produto.
* Atualizar itens encontrados.
* Exibir inconsistências para códigos inexistentes.

---

## Exportação de Pedido

Gerar arquivo Excel contendo:

| aba | codigo | produto | categoria | preco_tabela | quantidade | desconto | bonificados |
| --- | ------ | ------- | --------- | ------------ | ---------- | -------- | ----------- |

---

## Copiar Pedido

Disponibilizar botão "Copiar Pedido" em cada uma das abas principais.

### Objetivo

Permitir colagem direta em processos atuais de importação para Salesforce, respeitando a separação entre unidades de negócio.

### Comportamento Padrão

Cada aba deverá possuir seu próprio botão de cópia:

* Copiar Pedido Dentscare
* Copiar Pedido Home_Care
* Copiar Pedido Whiteness

Ao acionar o botão, deverão ser copiados apenas os itens pertencentes à aba selecionada.

Não deverá existir, no MVP, um botão padrão para copiar pedidos consolidados entre as três unidades de negócio.

### Formato Gerado

```text
4000030171	10
4000030172	5
4000056602	3
```

Formato:

```text
codigo<TAB>quantidade
```

### Regras

* Copiar apenas produtos com quantidade maior que zero.
* Copiar apenas produtos da aba atualmente selecionada.
* Não incluir bonificados nesta versão.
* Não incluir descontos nesta versão.
* A separação por unidade de negócio é obrigatória e representa o comportamento padrão da plataforma.

---

# Estrutura de Dados

## Produtos

Arquivos mantidos separadamente por linha de negócio.

```text
/data
├── Dentscare.json
├── Home_Care.json
└── Whiteness.json
```

Responsáveis por armazenar:

* Código
* Produto
* Categoria
* Cor de exibição

---

## Tabela de Preços

Estrutura separada dos produtos.

### Opção Inicial (MVP)

```json
{
  "4000030171": 125.00,
  "4000030172": 89.50,
  "4000056602": 32.90
}
```

Arquivo:

```text
/data
└── tabela_precos.json
```

### Evolução Futura

Substituir por banco de dados ou integração com Salesforce/SAP.

---

# Arquitetura Técnica

## Front-end

Tecnologia sugerida:

* Next.js (preferencial)
* React
* TypeScript

Bibliotecas:

* Material UI
* XLSX ou ExcelJS
* React Hook Form

---

## Back-end

Tecnologia sugerida:

* Next.js API Routes

Responsável por:

* Leitura dos JSONs.
* Importação de planilhas.
* Exportação de planilhas.
* Persistência da tabela de preços.

---

# Fluxos Operacionais

## Fluxo do Administrador

```text
Importa tabela de preços
        ↓
Sistema valida códigos
        ↓
Atualiza preços
        ↓
Disponibiliza tabela para vendedores
```

---

## Fluxo do Vendedor

```text
Acessa plataforma
        ↓
Seleciona aba (Dentscare, Home_Care ou Whiteness)
        ↓
Visualiza produtos e preços
        ↓
Preenche quantidades
        ↓
Aplica descontos
        ↓
Informa bonificados
        ↓
Copia pedido da unidade de negócio selecionada
ou
Exporta pedido
```

---

# Critérios de Aceitação

## Produtos

* Produtos carregados corretamente.
* Ordem preservada conforme JSON.
* Cores exibidas corretamente.
* Separação correta entre abas.

## Preços

* Administrador consegue importar preços.
* Administrador consegue exportar preços.
* Vendedor visualiza preços atualizados.
* Vendedor não consegue alterar preços.

## Pedido

* Quantidades editáveis.
* Descontos editáveis.
* Bonificados editáveis.
* Cada aba mantém seus próprios itens de pedido.

## Excel

* Importação funcionando.
* Exportação funcionando.

## Copiar Pedido

* Copia apenas código e quantidade.
* Copia apenas itens da aba selecionada.
* Existe um botão de cópia independente para cada unidade de negócio.
* Formato compatível com o processo atual do Salesforce.

---

# Itens Fora do Escopo do MVP

## Segurança

Não serão implementados nesta fase:

* Microsoft Entra ID (SSO)
* Controle por IP
* MFA
* Perfis corporativos integrados ao AD

## Integrações

Não serão implementadas nesta fase:

* Salesforce
* SAP
* Dataverse
* APIs corporativas

## Persistência Avançada

Não serão implementados nesta fase:

* Histórico de alterações
* Auditoria de preços
* Versionamento de tabelas
* Banco de dados relacional

---

# Fase 2 - Evoluções Futuras

## Segurança

* Login Microsoft Entra ID
* Controle por grupos corporativos
* MFA
* Restrição por IP corporativo

## Gestão

* Histórico de preços
* Versionamento de tabelas
* Controle de alterações

## Comercial

* Histórico de pedidos
* Modelos de pedido
* Duplicar pedido
* Favoritos
* Copiar pedido consolidado entre unidades de negócio (opcional)

## Integrações

* Salesforce
* SAP
* Atualização automática de preços
* Importação automática de pedidos

---

# Estimativa Inicial

| Etapa                         | Esforço |
| ----------------------------- | ------- |
| Estrutura do projeto          | 1 dia   |
| Carregamento dos JSONs        | 0,5 dia |
| Tela de produtos              | 1 dia   |
| Tela administrativa de preços | 1 dia   |
| Importação de preços          | 0,5 dia |
| Exportação de preços          | 0,5 dia |
| Importação de pedidos         | 0,5 dia |
| Exportação de pedidos         | 0,5 dia |
| Copiar pedido por aba         | 0,5 dia |
| Testes e ajustes              | 1 dia   |

**Estimativa total:** 6 a 8 dias úteis para MVP funcional.
