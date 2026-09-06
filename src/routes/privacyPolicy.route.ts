import type { Request, Response } from 'express';
import express from 'express';

const router = express.Router();

const PRIVACY_POLICY = {
  title: 'Política de Privacidade para MarquinhosBOT',
  date: 'Atualizado 19 de agosto de 2023',
  body: 'MarquinhosBOT ("nós," "nos," ou "nosso") está comprometido(a) em proteger a sua privacidade. Esta Política de Privacidade descreve como coletamos, usamos e protegemos as suas informações pessoais em relação ao uso do nosso bot no Discord.',
  sections: [
    {
      title: '1. Coleta de Dados',
      body: 'Coletamos as seguintes informações com o propósito de fornecer os nossos serviços: - Seu ID de usuário no Discord - Seu token de usuário no Discord (com o escopo "identity" apenas) - Seu token do Last.fm',
    },
    {
      title: '2. Propósito da Coleta de Dados',
      body: 'Coletamos essas informações exclusivamente com o propósito de integrar MarquinhosBOT ao Last.fm. Essa integração nos permite registrar músicas tocadas por outro bot na sua conta do Last.fm.',
    },
    {
      title: '3. Armazenamento de Dados',
      body: 'Os seus dados são armazenados de forma segura em nosso servidor pessoal. Esses dados só podem ser acessados por meio dos comandos do bot. A API pode criar ou excluir dados, mas não pode acessar as informações.',
    },
    {
      title: '4. Compartilhamento de Dados',
      body: 'Não compartilhamos as suas informações pessoais com terceiros. Seus dados são usados exclusivamente para habilitar a integração com o Last.fm.',
    },
    {
      title: '5. Direitos do Usuário',
      body: 'Você não tem acesso direto aos seus dados por meio do bot, por questões de segurança. No entanto, você pode usar a interface web fornecida para excluir todas as suas informações armazenadas a qualquer momento.',
    },
    {
      title: '6. Medidas de Segurança',
      body: 'Tomamos medidas para garantir a segurança dos seus dados, incluindo a restrição de acesso ao banco de dados apenas ao bot. A API não pode acessar os dados armazenados.',
    },
    {
      title: '7. Conformidade Legal',
      body: 'Não coletamos dados que exijam conformidade legal específica.',
    },
    {
      title: '8. Restrições de Idade',
      body: 'Nosso serviço está sujeito às restrições de idade definidas pelo Discord. Não coletamos informações relacionadas à idade.',
    },
    {
      title: '9. Atualizações da Política',
      body: 'Comunicaremos as atualizações a esta Política de Privacidade por meio de mensagens diretas do bot, incluindo um link para a página da Política de Privacidade.',
    },
    {
      title: 'Informações de Contato',
      body: 'Se tiver alguma dúvida ou preocupação sobre a nossa Política de Privacidade, você pode entrar em contato conosco através do nosso servidor no Discord: https://discord.gg/RKWBudnFe',
    },
  ],
};

router.get('/', async (req: Request, res: Response) => {
  return res.status(200).json(PRIVACY_POLICY);
});

export default router;
