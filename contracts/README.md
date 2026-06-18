# Contratos

Especificações formais da API REST e dos eventos de mensageria do sistema FIAP X.

## Conteúdo

| Arquivo | Tipo | Descrição |
|---|---|---|
| `asyncapi.yaml` | AsyncAPI 2.x | Contrato de eventos e mensageria. |
| `openapi.yaml` | OpenAPI 3.x | Contrato REST da API de processamento de vídeos. |

## Edição

Os arquivos são YAML padrão e podem ser editados em qualquer editor de texto. Para validação em tempo real, instale as extensões do Redocly e do AsyncAPI para VS Code.

## Validação

Requer Node.js. Execute na raiz do repositório:

```powershell
npx --yes @redocly/cli lint contracts/openapi.yaml
npx --yes @asyncapi/cli validate contracts/asyncapi.yaml
```

## Geração da documentação

A documentação HTML é gerada automaticamente no build da imagem Docker (Dockerfile multi-stage). Nenhum passo manual é necessário.

Para visualizar localmente, suba o container:

```powershell
docker compose up --build
```

A documentação fica disponível em:

| Contrato | URL local |
|---|---|
| REST API | `http://localhost:8080/contracts/openapi/` |
| Mensageria | `http://localhost:8080/contracts/asyncapi/` |

## Ferramentas

| Ferramenta | Uso | Documentação |
|---|---|---|
| Redocly CLI | Lint e geração do OpenAPI | [redocly.com/docs/cli](https://redocly.com/docs/cli/) |
| AsyncAPI CLI | Validação e geração do AsyncAPI | [asyncapi.com/docs/tools/cli](https://www.asyncapi.com/docs/tools/cli) |
