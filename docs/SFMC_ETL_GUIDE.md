# Guia de Integração: DWH (PostgreSQL) para SFMC

O Salesforce Marketing Cloud (SFMC) está localizado na nuvem pública, o que significa que **ele não consegue acessar o IP interno do seu banco de dados (`10.200.10.45`) por conta própria**. 

Se a `DE_FATURAMENTO` era atualizada até o dia 19/06, isso significa que **já existe (ou existia) um servidor ou script rodando na rede da sua empresa** responsável por extrair os dados e "empurrá-los" para o SFMC. Você precisa pedir para a TI localizar esse script (provavelmente parou de rodar ou deu erro de senha). 

Caso precisem recriar do zero, existem 2 formas oficiais de fazer isso:

---

## Método 1: Via SFTP + Automation Studio (Recomendado para grandes volumes)

Este é o método mais robusto e provavelmente o que a sua empresa já utilizava para o Faturamento.

### Passo 1: Script no Servidor Interno (Python / Node / Pentaho)
A equipe de dados cria um script que roda dentro da rede da empresa. O script faz o seguinte:
1. Conecta no PostgreSQL (`10.200.10.45:5433`).
2. Executa um `SELECT * FROM warehouse.f_shelf_life`, `d_material`, `f_faturamento`, etc.
3. Salva o resultado em arquivos CSV (ex: `faturamento.csv`, `shelf_life.csv`).
4. Conecta no **FTP do Salesforce (Enhanced FTP)** e faz o upload desses arquivos CSV.

### Passo 2: Configuração no SFMC (Automation Studio)
No Salesforce Marketing Cloud, você cria uma Automação:
1. Vá em **Automation Studio**.
2. Crie uma **File Drop Automation** (inicia automaticamente quando o CSV cai no FTP) ou uma automação agendada.
3. Adicione uma **Import Activity**. 
4. Configure a Import Activity para ler o arquivo `faturamento.csv` do FTP e dar um `Overwrite` ou `Update/Add` na Data Extension `DE_FATURAMENTO`.

---

## Método 2: Via REST API (Recomendado para atualizações em tempo real)

Se o volume não for massivo (menor que milhares de linhas por minuto), pode-se usar a API.

### Passo 1: Script no Servidor Interno
Um script rodando em um PC/Servidor da empresa faz o seguinte:
1. Conecta no PostgreSQL.
2. Formata os dados em JSON.
3. Chama a API do SFMC para inserir os dados na DE.

**Exemplo de requisição (Node.js/Python) que a TI teria que fazer:**
```http
POST /data/v1/async/dataextensions/key:DE_FATURAMENTO/rows
Host: [SEU_SUBDOMINIO].rest.marketingcloudapis.com
Authorization: Bearer [SEU_TOKEN_SFMC]
Content-Type: application/json

{
   "items": [
      {
         "codigo_faturamento": "123",
         "valor": 1500.00
      }
   ]
}
```

---

## O que você deve falar para a Engenharia de Dados:

> *"O nosso Salesforce parou de receber faturamento desde 19/06. Precisamos verificar qual servidor/ferramenta estava enviando os dados do IP 10.200.10.45 para o FTP ou API do SFMC. Quando encontrarem e consertarem, aproveitem o mesmo script para exportar também as visões `d_material`, `d_org_venda`, `f_shelf_life`, `f_preco_condicao` e `f_ordem_faturamento` para as suas respectivas Data Extensions no SFMC."*
