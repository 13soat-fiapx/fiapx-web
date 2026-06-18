# fiapx-web

Interface web para o sistema FIAP X de processamento de vídeos.

## Tecnologias

- [Alpine.js](https://alpinejs.dev/)
- [AsyncAPI CLI](https://www.asyncapi.com/docs/tools/cli)
- [Auth0](https://auth0.com/)
- [Nginx](https://nginx.org/)
- [Redocly CLI](https://redocly.com/docs/cli/)

## Configuração do ambiente

Copie o arquivo de exemplo e preencha as variáveis:

```powershell
Copy-Item .env.example .env
notepad .env
```

| Variável    | Descrição                                      |
|-------------|------------------------------------------------|
| `DOMAIN`    | Domínio do tenant Auth0                        |
| `CLIENT_ID` | Client ID da aplicação registrada no Auth0     |
| `AUDIENCE`  | Identificador da API registrada no Auth0       |
| `API_BASE`  | URL base da API de processamento de vídeos     |

### Como obter o Client ID

1. Acesse [manage.auth0.com](https://manage.auth0.com)
2. Navegue até **Applications**
3. Selecione **FIAP X Web**
4. Copie o valor de **Client ID** na aba **Settings**

## Execução

```powershell
docker compose up -d --build
```

Acesse a interface em [http://localhost:8080](http://localhost:8080).

## Autenticação

O login é feito via Auth0 com Resource Owner Password Grant: o usuário informa e-mail e senha na própria interface, que os envia diretamente para a API do Auth0 e recebe um JWT em troca.

Existem alternativas mais seguras (como o fluxo Authorization Code com PKCE), mas o contexto acadêmico com credenciais AWS Academy temporárias não justifica a complexidade extra.

## Contratos

Os contratos da API REST e de mensageria ficam em `contracts/`. A documentação HTML é gerada automaticamente durante o build e servida pelo Nginx nos caminhos `/contracts/openapi/` e `/contracts/asyncapi/`.

Consulte [Contratos](./contracts/README.md) para instruções de edição, validação e geração.

## Links úteis

- [Auth0 Dashboard](https://manage.auth0.com)
- [Interface web](https://d2nyagk7gn75jo.cloudfront.net) (hospedada em conta AWS com créditos temporários, pode não estar disponível)
- [Nginx - documentação oficial](https://nginx.org/en/docs/)
