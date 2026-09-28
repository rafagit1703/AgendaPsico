# Stacks do projeto
NodeJS
Fastify
vitest

# Arquitetura do projeto

No projeto vamos usar a ideia do SOLID coomo base;

# Regras do Projeto

A pasta 'specs/' é a fonte oficial de requisitos

antes de implementar qualquer mudança:
1. Ler todos os arquivos de 'specs/';
2. Identificar possiveis ambiguidades;
3. Verificar impacto no plano;
4. Atualizar testes;
5. somente então alterar código;

Não criar funcionalidades não descritas na SPEC !

Caso existir dúvidas de regra de negocio
registre a duvida em 'specs/duvidas.md'

Toda implementação deve possuir teste relacionados ao aceitar. 'specs/03-criterios-aceita.md'