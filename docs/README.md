# 📚 Documentação da Games API

Esta pasta contém a documentação completa da API de games do MarquinhosBOT.

## 📖 Arquivos Disponíveis

### 1. `GAMES_API.md`
**Documentação Técnica Completa**
- Explicação detalhada da arquitetura
- Guia de implementação de novos jogos
- Exemplos de código TypeScript
- Referência completa de tipos e métodos

### 2. `games-api.yaml`
**Especificação OpenAPI/Swagger**
- Documentação formal da API no padrão OpenAPI 3.0
- Todos os endpoints e schemas documentados
- Exemplos de requisições e respostas
- Compatível com ferramentas Swagger

### 3. `swagger-ui.html`
**Interface Visual Interativa**
- Visualização rica da documentação da API
- Interface Swagger UI customizada
- Exemplos interativos
- Design responsivo e amigável

### 4. `MarquinhosBOT-Games-API.postman_collection.json`
**Coleção Postman**
- Todos os endpoints pré-configurados
- Variáveis de ambiente automáticas
- Scripts de teste integrados
- Exemplos de requisições reais

### 5. `DEVELOPMENT_GUIDE.md`
**Guia Completo de Desenvolvimento**
- Setup do ambiente de desenvolvimento
- Tutorial detalhado para criar novos jogos
- Padrões de código e testes
- Debugging e otimização

## 🚀 Como Usar

### Visualizar Documentação Completa
```bash
# Abra o arquivo no seu editor favorito
code docs/GAMES_API.md

# Ou visualize no navegador se seu editor suportar
```

### Visualizar Interface Swagger
```bash
# Opção 1: Abrir arquivo HTML local
open docs/swagger-ui.html

# Opção 2: Servir via HTTP (recomendado)
cd docs
python -m http.server 8000
# Acesse: http://localhost:8000/swagger-ui.html

# Opção 3: Usar Live Server (VS Code)
# Clique direito no arquivo e "Open with Live Server"
```

### Usar Coleção Postman
```bash
# Importar coleção no Postman
# 1. Abrir Postman
# 2. File > Import > Choose Files
# 3. Selecionar MarquinhosBOT-Games-API.postman_collection.json
# 4. Configurar variáveis de ambiente (bot_token, guild_id, etc.)
# 5. Executar requisições

# Ou usar Newman (CLI do Postman)
npm install -g newman
newman run docs/MarquinhosBOT-Games-API.postman_collection.json
```

### Validar Especificação OpenAPI
```bash
# Instalar swagger-codegen (se necessário)
npm install -g swagger-codegen-cli

# Validar especificação
swagger-codegen validate -i docs/games-api.yaml

# Gerar client para outras linguagens
swagger-codegen generate -i docs/games-api.yaml -l typescript-axios -o generated/client
```

## 🎯 Para Desenvolvedores

### Implementar Novo Jogo
1. Leia o `GAMES_API.md` seção "Criando um Novo Jogo"
2. Consulte o `DEVELOPMENT_GUIDE.md` para tutorial completo
3. Siga o padrão estabelecido na pasta `src/game/`
4. Atualize os tipos em `GameTypes.ts`
5. Registre no comando `games.ts`
6. Implemente testes unitários

### Setup de Desenvolvimento
```bash
# Siga o guia completo
cat docs/DEVELOPMENT_GUIDE.md

# Setup rápido
npm install
npm run build
npm run dev
```

### Modificar API
1. Atualize `games-api.yaml` com as mudanças
2. Regenere a documentação se necessário
3. Teste com Swagger UI
4. Atualize exemplos no `GAMES_API.md`

### Gerar Documentação
```bash
# Gerar docs a partir do OpenAPI (opcional)
npx redoc-cli build docs/games-api.yaml --output docs/redoc.html
npx swagger-codegen generate -i docs/games-api.yaml -l html2 -o docs/generated
```

## 🛠️ Ferramentas Recomendadas

### Editores de OpenAPI
- [Swagger Editor](https://editor.swagger.io/) - Online
- [Insomnia](https://insomnia.rest/) - Desktop
- [Postman](https://www.postman.com/) - Desktop/Web
- [VS Code OpenAPI Extension](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi)

### Validação e Testes
- [Swagger Inspector](https://inspector.swagger.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Spectral](https://stoplight.io/open-source/spectral) - Linting

## 📊 Estrutura da API

```
Games API
├── Sessions Management     # Gerenciar sessões de jogo
├── Casino Games           # 5 jogos de cassino
├── Knowledge Games        # 4 jogos de conhecimento
├── Word Games            # 4 jogos de palavras
├── Strategy Games        # 4 jogos de estratégia
├── Multiplayer Games     # 3 jogos competitivos
└── Stats & Rankings      # Estatísticas e rankings
```

## 🎮 Jogos Disponíveis

### 🎰 Cassino (5 jogos)
- **Caça-níqueis** - Slots com multiplicadores
- **Blackjack** - Jogo clássico de 21
- **Dados Mágicos** - Apostas em combinações
- **Roleta Russa** - Tensão e sobrevivência
- **Loteria** - Sorteio com 6 números

### 🧠 Conhecimento (4 jogos)
- **Quiz Musical** - Perguntas sobre música
- **Geografia** - Conhecimentos geográficos
- **Cultura Pop** - Cinema, TV, games
- **História BR** - História do Brasil

### 📝 Palavras (4 jogos)
- **Palavra Secreta** - Forca moderna
- **Anagrama** - Palavras embaralhadas
- **Rima Rápida** - Competição de rimas
- **Tradução** - Traduzir entre idiomas

### 🧩 Estratégia (4 jogos)
- **Jogo da Velha** - Clássico 3x3
- **Código Secreto** - Quebrar códigos
- **Pedra, Papel, Tesoura** - Torneio épico
- **Labirinto** - Escape mental

### 🏆 Multiplayer (3 jogos)
- **Speed Math** - Cálculos rápidos
- **Battle Royale** - Eliminação com desafios
- **Caça ao Tesouro** - Resolver pistas em equipe

## 🔧 Exemplos de Integração

### Criar uma Sessão
```typescript
const session = gameManager.createSession(
  GameType.BLACKJACK,
  'guild-id',
  'channel-id', 
  'user-id'
);
```

### Processar Ação
```typescript
await gameInstance.handlePlayerAction(userId, {
  type: 'hit',
  data: {}
});
```

### Obter Estado do Jogo
```typescript
const embed = gameInstance.getGameEmbed();
const buttons = gameInstance.getActionButtons();
```

## 📈 Métricas e Analytics

A API coleta automaticamente:
- ✅ Número de jogos por tipo
- ✅ Duração média das sessões
- ✅ Taxa de conclusão
- ✅ Performance dos jogadores
- ✅ Uso por servidor/canal

## 🆘 Suporte

### Problemas Comuns
1. **Sessão não encontrada** - Verificar se não expirou
2. **Cooldown ativo** - Respeitar tempos de espera
3. **Jogo não iniciado** - Verificar estado da sessão
4. **Ação inválida** - Validar tipo e dados da ação

### Debug e Logs
```typescript
// Informações de debug
gameManager.debugInfo();

// Estatísticas de sessão
gameManager.getSessionStats(sessionId);

// Limpeza forçada
gameManager.forceCleanup();
```

## 🔄 Atualizações

Esta documentação é atualizada automaticamente quando:
- Novos jogos são adicionados
- APIs são modificadas
- Funcionalidades são alteradas

Para sugerir melhorias na documentação, abra uma issue ou PR no repositório.

## 🔗 Links Úteis

### Documentação
- 📖 [Documentação Técnica Completa](./GAMES_API.md)
- 🛠️ [Guia de Desenvolvimento](./DEVELOPMENT_GUIDE.md)
- 📊 [Interface Swagger](./swagger-ui.html)
- 📄 [Especificação OpenAPI](./games-api.yaml)

### Ferramentas
- 🧪 [Coleção Postman](./MarquinhosBOT-Games-API.postman_collection.json)
- 🌐 [Swagger Editor Online](https://editor.swagger.io/)
- 🔍 [OpenAPI Generator](https://openapi-generator.tech/)
- 📚 [Discord.js Docs](https://discord.js.org/#/docs/)

### Recursos Externos
- 🎮 [Discord Developer Portal](https://discord.com/developers/applications)
- 📦 [npm - Discord.js](https://www.npmjs.com/package/discord.js)
- 🎯 [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- 🧪 [Jest Testing Framework](https://jestjs.io/docs/getting-started)

---

**🎮 Happy Gaming!** 

Para mais informações, consulte os arquivos individuais ou entre em contato com a equipe de desenvolvimento.
