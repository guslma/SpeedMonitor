<div align="center">
  <img src="client/public/assets/img/speedmonitor-icon.svg" alt="SpeedMonitor" width="96" height="96">
  <h1>SpeedMonitor</h1>
  <p>Acompanhe a velocidade e as quedas da sua internet ao longo do tempo.</p>
</div>

![Estatísticas do SpeedMonitor](docs/screenshots/estatisticas.png)

## O que é

O SpeedMonitor roda testes de velocidade automaticamente (download, upload, ping e jitter), guarda o histórico e mostra tudo em gráficos e estatísticas. Entre um teste e outro, ele confere a conexão a cada 30 segundos para registrar cada queda. Com isso dá para saber quando a internet caiu, por quanto tempo, em que horário ela fica lenta e se a operadora entrega a velocidade contratada.

## Recursos

- **Estatísticas como página inicial**: download, upload, ping, estabilidade, médias por horário e um resumo da conexão
- **Registro de quedas**: início, fim e duração de cada queda, e a disponibilidade do período. Com o endereço do roteador configurado, ele também indica se a queda foi do provedor ou da rede de casa
- **Plano contratado**: compara a velocidade medida com o plano, mês a mês, usando a referência da Anatel (média de pelo menos 80% do contratado e pelo menos 40% em 95% dos testes)
- **Relatório para imprimir ou salvar em PDF**, com quedas, testes abaixo do mínimo e testes que falharam. Serve de base para uma reclamação na operadora ou na Anatel
- **Avisos em português** por Telegram, ntfy, Discord, Gotify, Pushover ou webhook: quando a internet volta depois de uma queda, quando a velocidade fica abaixo do plano e ao fim de cada teste
- **Lista completa dos testes**, seletor de período e exportação em CSV e JSON
- **Testes agendados** com servidores Ookla, LibreSpeed ou Cloudflare
- **Painel personalizável**: arraste os cards para mudar a ordem, puxe o canto para mudar a largura e a altura, e oculte o que não quiser ver (botão de grade no cabeçalho ou Configurações → Personalizar painel)
- **Tema claro e escuro**, layout que aproveita telas grandes e se ajusta ao celular
- **Várias instâncias** num painel só e **métricas para Prometheus e Grafana**

## Telas

### Conexão: quedas e plano contratado

Clique no card **Conexão** para ver cada queda e se o plano foi cumprido em cada mês.

![Detalhes da conexão](docs/screenshots/conexao.png)

### Relatório de qualidade

Em **Gerar relatório**, o período escolhido vira uma página pronta para imprimir ou salvar em PDF.

![Relatório de qualidade da internet](docs/screenshots/relatorio.png)

### Tema claro

![Estatísticas no tema claro](docs/screenshots/estatisticas-claro.png)

### Lista de testes

![Lista de testes](docs/screenshots/testes.png)

### No celular

<img src="docs/screenshots/celular.png" alt="SpeedMonitor no celular" width="320">

## Como instalar

Funciona em qualquer máquina Linux que fique ligada, como um mini PC, um Raspberry Pi ou um servidor caseiro, e dá para fazer tudo pelo terminal.

**1. Instale o Docker** (pule se já tiver):

```bash
curl -fsSL https://get.docker.com | sudo sh
```

**2. Baixe o código e gere a imagem:**

```bash
git clone https://github.com/guslma/SpeedMonitor.git
cd SpeedMonitor
sudo docker build -t speedmonitor .
```

Sem `git`, baixe o código assim:

```bash
curl -L https://github.com/guslma/SpeedMonitor/archive/refs/heads/main.tar.gz | tar xz
cd SpeedMonitor-main
```

Gerar a imagem leva alguns minutos e baixa algumas centenas de MB. Num Raspberry Pi, demora mais.

**3. Inicie o SpeedMonitor:**

```bash
sudo docker run -d --name speedmonitor \
  -p 5216:5216 \
  -e TZ=America/Sao_Paulo \
  -v ~/speedmonitor-data:/app/data \
  --restart unless-stopped \
  speedmonitor
```

- `TZ` é o fuso horário, usado nos horários dos avisos e do relatório.
- `~/speedmonitor-data` é onde ficam o banco e as configurações, então dá para recriar o contêiner sem perder o histórico.
- `--restart unless-stopped` faz ele voltar sozinho depois que a máquina reinicia.

**4. Abra no navegador:** `http://IP-DA-MÁQUINA:5216`, de qualquer aparelho da mesma rede. Para descobrir o IP, rode `hostname -I` na máquina. Na primeira vez, um assistente pede para escolher o servidor de testes.

### Atualizar

```bash
cd SpeedMonitor
git pull
sudo docker build -t speedmonitor .
sudo docker rm -f speedmonitor
```

Depois, rode de novo o comando do passo 3. O histórico continua em `~/speedmonitor-data`.

### Acessar de fora de casa

A página só abre na rede local. Para ver de outro lugar, o jeito mais simples é instalar o [Tailscale](https://tailscale.com) na máquina e no seu celular ou computador. Não precisa abrir portas no roteador.

## Primeiros ajustes

1. **Plano e conexão** (em Configurações): informe o download e o upload contratados e o endereço do roteador, por exemplo `192.168.1.1`. Para descobrir o endereço do roteador, rode `ip route | grep default` na máquina.
2. **Integrações** (em Configurações): escolha onde receber os avisos e ligue "Avisar quando a internet cair". O jeito mais simples é o [ntfy](https://ntfy.sh): instale o app no celular, escolha um tópico e use `https://ntfy.sh` como servidor.
3. **Definir frequência**: cada teste completo gasta algumas centenas de MB. Como as quedas são registradas à parte, dá para espaçar os testes (por exemplo, a cada 2 horas) e gastar menos internet sem perder nenhuma queda. Isso vale a pena principalmente em internet com franquia.

## Licença

Distribuído sob a licença MIT. Veja o arquivo [`LICENSE`](LICENSE).
