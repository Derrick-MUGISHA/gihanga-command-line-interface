# Gihanga Command Line Interface

Gihanga ni umufasha/ejenti wa AI mu kwandika kode ukoreshwa muri terminal, ushyira Ikinyarwanda imbere. Ifasha abanditsi ba porogaramu gusoma, guhindura, kwandika, no gukoresha kode hifashishijwe command line.

Urubuga: https://console.upskillsafrica.org

> Iyi README ishyira Ikinyarwanda imbere.  
> English documentation: [README.en.md](README.en.md)

## Icyo ikora

- Ifungura umufasha wa kode muri terminal ukoresheje `gihanga`
- Isoma amadosiye ya poroje kandi igasobanura kode
- Ihindura cyangwa ikandika amadosiye iyo ubiyisabye
- Ikoresha shell commands ibinyujije mu gikoresho cya bash
- Ishyigikira providers na models zitandukanye za AI
- Ishyigikira ubumenyi, ingereko, prompt templates, na themes
- Igaragaza ubufasha bwa CLI n'amabwiriza ya `/` mu Kinyarwanda-first

## Igishushanyo cya terminal

```text
┌──────────────────────────────┐
│          Gihanga CLI          │
│ Umufasha wa AI mu Kinyarwanda │
└───────────────┬──────────────┘
                │
                ▼
┌──────────────────────────────┐
│ gihanga                      │
│ Tangiza umufasha muri terminal│
└───────────────┬──────────────┘
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│  read   │ │  edit   │ │  bash   │
│ amadosiye││  kode   │ │ command │
└────┬────┘ └────┬────┘ └────┬────┘
     └──────────┼──────────┘
                ▼
┌──────────────────────────────┐
│ Andika impinduka, sobanura   │
│ kode, ukomeze ukorera local  │
└──────────────────────────────┘
```

## Ibisabwa

- Linux, macOS, cyangwa Windows terminal
- Node.js `>=22.19.0`
- npm
- Git
- Credential ya AI provider imwe ishyigikiwe, cyangwa kwinjira ukoresheje CLI

## Install kuri Linux / macOS

Koresha iyi command:

```bash
curl -fsSL https://console.upskillsafrica.org/install.sh | bash
```

Niba ushaka indi folder:

```bash
curl -fsSL https://console.upskillsafrica.org/install.sh | GIHANGA_INSTALL_DIR="$HOME/Tools/gihanga-cli" bash
```

## Install kuri Windows

Koresha PowerShell:

```powershell
iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex
```

Niba ushaka indi folder:

```powershell
$env:GIHANGA_INSTALL_DIR="$HOME\Tools\gihanga-cli"; iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex
```

Iyi installer ishyira cyangwa ivugurura Gihanga CLI muri `~/.gihanga-cli`, ikayubaka, hanyuma igahuza command `gihanga` kuri uyu mukoresha.

Install inashyiramo ubumenyi bwa Gihanga n'amagambo y'Ikinyarwanda muri `~/.gihanga/agent`:

- `skills/gihanga-community/SKILL.md`
- `data/kinyarwanda-keywords.json`
- `data/community-translation-list.csv`
- `data/kinyarwanda-dataset-sources.json`
- `scripts/import-mbaza-nlp.mjs`

### Install na Mbaza NLP dataset

Mbaza NLP raw dataset ni nini, ntabwo tuyishyira muri GitHub repo. Ushobora kuyikurura mu gihe cya install ukoresheje flag:

```bash
GIHANGA_INSTALL_MBAZA_NLP=1 curl -fsSL https://console.upskillsafrica.org/install.sh | bash
```

Niba ushaka metadata gusa, nta parquet download:

```bash
GIHANGA_INSTALL_MBAZA_NLP=1 GIHANGA_MBAZA_METADATA_ONLY=1 curl -fsSL https://console.upskillsafrica.org/install.sh | bash
```

Ku dataset gated nka `mbazaNLP/kinyarwanda_monolingual_v01.1`, banza wemere terms kuri Hugging Face, hanyuma ukoreshe `HF_TOKEN`:

```bash
HF_TOKEN=your_token GIHANGA_INSTALL_MBAZA_NLP=1 GIHANGA_MBAZA_NLP_DATASET=mbazaNLP/kinyarwanda_monolingual_v01.1 curl -fsSL https://console.upskillsafrica.org/install.sh | bash
```

## Manual install

```bash
git clone https://github.com/DannyIRUMVA/gihanga-command-line-interface.git
cd gihanga-command-line-interface
npm install --ignore-scripts
npm run build
cd packages/coding-agent
npm link
gihanga --help
```

Nyuma y'ibi, command `gihanga` izajya ikora aho uri hose kuri mudasobwa yawe kuri uyu mukoresha.

## Kuvugurura local install

```bash
cd gihanga-command-line-interface
git pull
npm install --ignore-scripts
npm run build
cd packages/coding-agent
npm link
gihanga --version
```

## Imikoreshereze y'ibanze

```bash
# Tangira uburyo bw'ibiganiro
gihanga

# Baza ikibazo kimwe hanyuma usohoke
gihanga -p "Sobanura iyi poroje"

# Shyiramo dosiye mu butumwa bwa mbere
gihanga @README.md "Vuga muri make iyi dosiye"

# Erekana ubufasha
gihanga --help

# Erekana models zihari
gihanga --list-models
```

## Amategeko akoreshwa cyane

```bash
gihanga install <source>      # Injiza extension/package source
gihanga remove <source>       # Kuramo extension/package source
gihanga update                # Vugurura Gihanga
gihanga list                  # Erekana packages/extensions zinjijwe
gihanga config                # Fungura igenamiterere rya package resources
```

Mu buryo bw'ibiganiro, andika `/` kugira ngo ubone slash commands nka:

```text
/settings
/model
/kwinjira
/continue
/new
/compact
/sohoka
```

## Kwinjira / Authentication

Ushobora gutangira Gihanga hanyuma ugakoresha `/kwinjira`:

```bash
gihanga
# hanyuma wandike: /kwinjira
```

Cyangwa ugashyiraho API key ukoresheje environment variables, urugero:

```bash
export ANTHROPIC_API_KEY="your-api-key"
gihanga
```

Providers zishyigikiwe zirimo Anthropic, OpenAI, Google Gemini, GitHub Copilot, OpenRouter, Groq, Cerebras, Mistral, Amazon Bedrock, Cloudflare, n'izindi.

## Iterambere / Development

```bash
npm install --ignore-scripts
npm run build
npm run check
./gihanga-test.sh
```

Kuri Windows development:

```powershell
.\gihanga-test.ps1
```

## Icyitonderwa

- Command nyamukuru ni `gihanga`.
- Command syntax nka `install` iguma mu Cyongereza kugira ngo copy-paste compatibility ikomeze, ariko help text n'inyandiko rusange bikoresha Ikinyarwanda-first.


## License

MIT open source license. Ushobora gukoresha, gukoporora, guhindura, gusangiza, gutanga sublicense, no kugurisha kopi ukurikije ibiri muri [LICENSE](LICENSE).
