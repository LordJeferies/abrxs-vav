# ABRXSVAV — HANDOFF UX (prompts para IA externa: copiar · TXT · batch)

> El usuario siempre puede (y quiere) generar imágenes/videos FUERA de la app pegando
> prompts en Kling/Veo/Runway/Freepik/ChatGPT. Esto no es un parche: `manual_handoff` es
> un modo de materialización de primera clase (contracts v2.2) y se implementa **antes**
> que las APIs de pago. Todo lo de este doc usa el contrato `HandoffPackage`.

## 1. Prompt Card — la unidad (por slot o por evento)

Cada `VisualPlanItem` y cada `AssetSlot` tiene botón **"Exportar para IA externa"** que
abre la tarjeta:

```
┌─ HANDOFF · BR03 · "ciudad de noche con lluvia" ────────┐
│                                                         │
│  PROMPT          [copiar]                               │
│  ─────────────────────────────────────────────────      │
│  Vertical night city street in heavy rain, neon        │
│  reflections on wet asphalt, cinematic, teal-orange…   │
│                                                         │
│  NEGATIVE        [copiar]                               │
│  people, text, watermark, low contrast, flat lighting  │
│                                                         │
│  OUTPUT SPEC                                            │
│  Aspect 9:16 · Duración 8s · 24fps · Motion: push-in   │
│                                                         │
│  FRAME INICIAL    [descargar imagen]  (para i2v)       │
│  REFERENCIAS      A01_ref.png · brand palette           │
│                                                         │
│  GUARDAR COMO: BR03_tokyo-night.mp4  ← nombre esperado  │
│  [Copiar todo] [Descargar .txt] [QR]                    │
└─────────────────────────────────────────────────────────┘
```

Reglas de la tarjeta:
- **Selector de provider hint**: `kling | veo | runway | generic` — el mismo prompt,
  redactado según las reglas del provider (estructura de clauses, negative separado,
  mención de motion). El texto del prompt sale del `AssetSlot.prompt` redactado por el
  Visual Director; si no hay, "Redactar con IA" (capability `llm.complete`) usando frame
  de referencia + reglas del Client Profile.
- **Un clic = copiar** cada campo; [Copiar todo] copia el paquete completo formateado.
- **`expectedFilename`** visible siempre: es la clave del retorno.
- Los prompts usados se registran como `PromptRecord` (reproducibilidad).

## 2. Los 3 niveles de exportación

1. **Copia instantánea** — en timeline, Visual Plan y Visual Lab: inspector con el prompt
   del evento + botón copiar. Cero fricción.
2. **TXT individuales** — cada slot genera su `.txt` con: prompt, negative, output spec,
   nombre esperado, instrucciones de retorno. Sirve para subir a IAs que aceptan archivos
   o para archivar.
3. **Batch export** — desde Visual Plan o desde la pieza: **"Exportar handoff batch"**:

```
HANDOFF_EP32/
├── _LEEME.txt                 ← cómo volver a importar + convención de nombres
├── C07/
│   ├── BR03_tokyo-night.txt   ← prompt completo dentro
│   ├── XR07_glass-title.txt
│   └── C07_ALL_PROMPTS.txt    ← todos los prompts de la pieza en un solo archivo
├── C08/
│   └── …
└── frames/                    ← imágenes inicio/fin para i2v, ya nombradas
    └── BR03_start.png
```

`C07_ALL_PROMPTS.txt` permite pegar todo en un solo chat (ChatGPT/Claude/Gemini) para
variantes; los `.txt` individuales alimentan generadores uno a uno; el `_LEEME.txt`
documenta la convención de nombres para que el retorno sea automático.

## 3. El retorno: Import Result

1. El usuario genera fuera, descarga el resultado con el nombre esperado.
2. Lo arrastra a la app (o a Visual Lab → "Importar resultado") — o usa la acción
   `vav.handoff.import_result` por MCP.
3. El `ImportResult` matchea por `expectedFilename` (con tolerancia: sufijos de download,
   mayúsculas). Match seguro → el item pasa a `generated`, asset adjuntado con
   provenance `origin: "manual"` + `providerId` del hint. Ambiguo → lista de candidatos.
   Sin match → se ofrece elegir destino a mano.
4. Nunca se reconfigura nada: el evento ya sabía qué era.

## 4. Acciones del ActionCatalog

| ACCIÓN | DESDE |
|---|---|
| `vav.handoff.export_package` (slot o item → HandoffPackage JSON) | paso 6 |
| `vav.handoff.export_txt` (uno) | paso 6 |
| `vav.handoff.export_batch` (pieza/proyecto → carpeta organizada) | paso 6 |
| `vav.handoff.import_result` (archivo → match + attach) | paso 6 |
| `vav.handoff.draft_prompt` (redactar prompt con LLM usando contexto) | paso 6 |

## 5. Relación con los otros caminos

| CAMINO | CUÁNDO | CÓMO |
|---|---|---|
| **Manual handoff** (este doc) | Siempre disponible; primero en implementarse | Copiar/TXT/batch + Import Result |
| native_api | Cuando el provider tiene API (Kling, Pexels, NVIDIA NIM imágenes) | Provider Registry, con confirmación de coste |
| browser_adapter | Último recurso automatizado | Plugin Playwright aislado; jamás core |

El Modo A (handoff) es el fallback permanente del Modo B (browser) — si un sitio cambia,
el usuario nunca queda bloqueado.
