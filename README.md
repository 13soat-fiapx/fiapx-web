# fiapx-web

Interface web para o sistema FIAP X de processamento de vídeos.

## Tecnologias

- [Alpine.js](https://alpinejs.dev/)
- [Auth0](https://auth0.com/)
- [Nginx](https://nginx.org/)

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

## Links úteis

- [Auth0 Dashboard](https://manage.auth0.com)
- [Documentação do Alpine.js](https://alpinejs.dev/)
- [Nginx - documentação oficial](https://nginx.org/en/docs/)
