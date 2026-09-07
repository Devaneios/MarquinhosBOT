# MarquinhosBOT
## Bot do discord desenvolvido em JS

- **Comandos:**
	- [Lista de Comandos](commands/README.md)
- **Funções:**
	- Gerencia mensagens
	- Gerencia links
	- Atribui permissões a novos integrantes
	- Contextualiza saídas/entradas no servidor
	- Te recomenda coisas
	- *Distribui amor para todos!* :P
- **Eventos:**
	- Heartbeat criativo
	- Quinta-feira
	- Sexta-Feira
	- Bom dia

### IA

Três formas de falar com a IA, todas servidas pela `marquinhos-web-api`:

| Como | O que faz |
|---|---|
| `@Marquinhos <mensagem>` | Resposta na hora, em reply, com a persona do Marquinhos e respostas customizadas por tipo de mensagem. Só no canal Devaneios. |
| `/ia perguntar <pergunta>` | Abre uma **thread** e responde lá, com acesso a busca na web, leitura de páginas, sandbox de código e ao próprio código-fonte. A thread mantém o contexto da conversa — incluindo o raciocínio do modelo — então qualquer pessoa pode continuar perguntando na thread **sem precisar marcar o bot**. |
| `/ia pesquisar <tema>` | Pesquisa profunda numa thread: planeja as frentes de busca, busca no SearXNG, lê as páginas, cruza as informações e entrega um relatório completo com citações e lista de fontes. Leva alguns minutos e o progresso vai sendo postado na thread. |

O reasoning do modelo nunca é postado na thread — ele é mantido no contexto entre turnos e gravado nos traces da API para debug.
- **Futuramente:**
    - Implementação de DB para gestão de dinheiro interno de servidor
	- Implementação de parâmetros no !diga para especificar seu gosto
	
![O Marquinhos](https://i.imgur.com/KtfKQ5h.jpg)

Para usar esse amor de Bot, basta clonar o repositório, e configurar o arquivo .env_sample para
.env, atribuindo os valores do seu servidor no arquivo principal! Divirta-se com o meu
bebê! :)

- **Contribuidores:**
<table>
	<tr>
		<td align="center">
			<a href="https://github.com/tiago-ds">
				<img src="https://avatars.githubusercontent.com/u/42779343?v=3?s=100" width="100px;" alt=""/>
				<br />
				<sub>
					<b>Tiago Campêlo</b>
				</sub>
			</a>
			<br />
			<a href="https://github.com/tiago-ds/Public-MarquinhosBOT/commits?author=tiago-ds" title="Code">💻</a>
		</td>
		<td align="center">
			<a href="https://github.com/guilhermeasper">
				<img src="https://avatars.githubusercontent.com/u/18534480?v=3?s=100" width="100px;" alt=""/>
				<br />
				<sub>
					<b>Guilherme Afonso</b>
				</sub>
			</a>
			<br />
			<a href="https://github.com/tiago-ds/Public-MarquinhosBOT/commits?author=guilhermeasper" title="Code">💻</a>
		</td>
		<td align="center">
			<a href="https://github.com/Giancarl021">
				<img src="https://avatars.githubusercontent.com/u/44367174?v=3?s=100" width="100px;" alt=""/>
				<br />
				<sub>
					<b>Giancarlo Fontela da Luz</b>
				</sub>
			</a>
			<br />
			<a href="https://github.com/tiago-ds/Public-MarquinhosBOT/commits?author=Giancarl021" title="Code">💻</a>
		</td>
		<td align="center">
			<a href="https://github.com/Erick2280">
				<img src="https://avatars.githubusercontent.com/u/5215968?v=3?s=100" width="100px;" alt=""/>
				<br />
				<sub>
					<b>Erick Almeida</b>
				</sub>
			</a>
			<br />
			<a href="https://github.com/tiago-ds/Public-MarquinhosBOT/commits?author=Erick2280" title="Code">💻</a>
		</td>
	</tr>
</table>
