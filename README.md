# 📌 Mural de Post-its para Conversas

Um mural de post-its interativo, leve e carinhoso para duas pessoas alinharem conversas, planos e assuntos importantes sem a frieza de um gerenciador de tarefas.

## 🚀 Funcionalidades Implementadas

- **Mural estilo pin-board / cortiça:** com suporte a temas visuais (Cortiça, Madeira e Modo Escuro).
- **Post-its totalmente customizáveis:**
  - Paleta com 6 cores clássicas de post-it.
  - 5 famílias de fontes manuscritas fluídas (*Caveat*, *Patrick Hand*, *Shadows Into Light*, *Indie Flower*, *Kalam*).
  - 3 tamanhos (Pequeno, Médio, Grande) e rotação sutil colada à mão.
  - Emojis e níveis de sensibilidade do assunto (🌱 Leve, ⚖️ Atenção, 💬 Conversa importante).
- **Post-its Guardados 🔒 (Web Crypto API):**
  - Criptografia de ponta a ponta no cliente via AES-GCM (256-bit) com derivação PBKDF2.
  - O conteúdo confidencial nunca sobe em texto claro pro GitHub; apenas quem tem a senha consegue revelar.
  - Opção de deixar uma dica pública pré-abertura (ex: *"Abre no sábado 👀"*).
- **Reações Rápidas e Interações:** reaja com ❤️, 👀 ou 😅 e marque conversas concluídas com ✅.
- **Histórico de Conversas Concluídas 📜:** gaveta dedicada para rever assuntos resolvidos ou reabri-los quando quiser.
- **Suporte Mobile e Desktop:** gestos touch fluidos para celulares/tablets sem rolagem acidental de tela.
- **Sincronização Serverless via GitHub Pages:**
  - Armazena e versiona os dados no `data.json`.
  - Polling a cada 15 segundos e ao focar na aba.
  - Tratamento de concorrência com retries automáticos em caso de HTTP 409 (conflito de SHA).

---

## 🛠️ Como Usar e Configurar

1. **Abra o arquivo localmente:**
   - Dê dois cliques em `index.html` ou use um servidor local (ex: Live Server do VSCode).
2. **Conecte com o GitHub (opcional para multi-dispositivo):**
   - Clique no ícone de engrenagem **⚙️** no topo direito.
   - Selecione se você é **Vitor (Eu)** ou **Ela**.
   - Insira o repositório (`usuario/repositorio`) e um **Fine-grained Personal Access Token** com permissão `Contents: Read and write`.
   - *Nota:* O token fica armazenado estritamente no `localStorage` do seu navegador e nunca é commitado no repositório.
3. **Modo Offline/Local:**
   - O mural funciona perfeitamente mesmo sem token do GitHub, mantendo os dados salvos no `localStorage`.
