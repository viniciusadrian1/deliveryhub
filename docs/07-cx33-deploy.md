# Deploy na CX33

O serviço web precisa receber `NEXT_PUBLIC_API_URL` como **build argument** antes
de `next build`. O valor definido somente em `environment`/`env_file` no container
não modifica o JavaScript já compilado no navegador.

O Dockerfile valida a URL e verifica se ela foi incorporada ao cliente da API.
A `.dockerignore` exclui segredos, `node_modules`, `.next` e `dist`; API e adapters
são compilados a partir dos fontes. Validar as imagens limpas antes da publicação.

## Publicação

- Construir uma release a partir de `git archive <commit>` em um diretório novo.
  Não fazer stash/pull/pop no checkout operacional: a CX33 possui configurações
  locais que precisam continuar preservadas.
- Usar `/opt/deliveryhub/.env` e o compose de produção do servidor como configuração
  de execução. Nunca inserir seu conteúdo em imagens ou commits.
- Guardar os IDs das imagens em execução com tags de rollback antes da troca.
- Construir API e web separadamente, com a URL pública definida na web; executar
  verificações de dependências e iniciar as imagens em portas locais temporárias.
- Somente após validar as imagens, recriar `api`, `worker` e `web` com
  `docker compose -p deliveryhub ... up -d --no-deps --no-build api worker web`.
  Preservar os volumes e containers de Postgres/Redis.

## Aceite

`GET /api/healthz` deve retornar 200. `/` e `/health` na API não são endpoints de
saúde e retornar 404 não valida a aplicação. `/api/readyz` atualmente é uma resposta
estática: validar também autenticação e consulta autenticada ao banco.

Verificar o formulário de login no navegador publicado: credenciais fictícias
devem receber “E-mail ou senha incorretos”, não erro de conexão. Usar uma conta de
teste isolada para confirmar login válido, `/api/me`, refresh, Hub, estoque e
financeiro. Recarregar a página para validar persistência da sessão.

Confirmar que os containers não reiniciam, que o worker iniciou e que não há
novos erros de banco/módulos. Se o aceite falhar, restaurar as tags de rollback e
recriar apenas os serviços de aplicação com `--no-build`.
