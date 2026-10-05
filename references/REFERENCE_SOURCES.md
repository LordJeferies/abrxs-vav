# Reference Sources · repos, productos y videos a estudiar

> Estos enlaces son **biblioteca de ingeniería**. No significan que Abraxas deba depender de cada proyecto. Para cada fuente decidir: REFERENCE / ADAPT / REUSE / INTEGRATE. Verificar licencia y versión antes de copiar código.

## Núcleo visual / workflows

1. MoneyPrinterTurbo — https://github.com/harry0703/MoneyPrinterTurbo/tree/main  
   Estudiar: material search, stock providers, TTS/subtitles/media pipeline, faceless generation. Adaptar especialmente el concepto de búsqueda/resolución de materiales dentro de Visual Lab.

2. Node Banana — https://github.com/shrimbly/node-banana  
   Estudiar/reutilizar selectivamente: XYFlow node editor, typed handles, topological execution, Array, Router/Switch, provider abstraction, ComfyUI workflows, gallery/compare/ease nodes.

3. Vibe Workflow — https://github.com/SamurAIGPT/Vibe-Workflow  
   Estudiar: UX de workflow, templates, run/output history. No adoptar el backend acoplado como core.

4. React Flow — https://reactflow.dev  
5. XYFlow — https://github.com/xyflow/xyflow  
   Integración candidata para Workflow Studio, Project Map y recipe editor.

6. Langflow — https://www.langflow.org/  
   Estudiar: Human-in-the-loop, state/checkpoints, agent tools, MCP/A2A concepts.

7. Flowise — https://flowiseai.com/  
   Referencia histórica solamente; revisar estado/EOL antes de cualquier uso.

8. n8n — https://n8n.io/  
   Estudiar solo patrones de ejecución, branching, retries, batch, manual approval y histories para automatización audiovisual; no convertir Abraxas en automatizador generalista.

## Render, motion y video programático

9. VideoFlow Studio — https://studio.videoflow.dev  
10. VideoFlow — https://videoflow.dev  
11. VideoFlow repo — https://github.com/ybouane/VideoFlow  
    Estudiar/integrar por adapter: VideoJSON, preview, browser/server render, editor, effects, groups, frame time formats. Production Graph sigue canónico.

12. OpusClip Video Tools — https://github.com/opus-pro/opusclip-video-tools  
    Estudiar/reutilizar lo permitido: machine-readable template catalogs, Visual Packs, Motion Specs, previews, checksums, components, Remotion structure.

13. Creativly Magnific Remotion — https://github.com/naveen-annam/creativly.ai-magnific-video-remotion  
14. Naveen Annam repos — https://github.com/naveen-annam  
15. Creativly.ai — https://www.creativly.ai  
    Estudiar: scene/beat architecture, centralized tokens (palette/fonts/motion), AI assets, BYOK/Flow/Agent product UX.

16. LiquidGlass demo — https://liquid-glass.ybouane.com  
17. LiquidGlass repo — https://github.com/ybouane/liquidglass  
    Estudiar/reutilizar: UI glass language y también effects/overlays de video/WebGL. Usar con performance budget.

18. ffmpeg-ui — https://github.com/ybouane/ffmpeg-ui  
    Estudiar si el repo adquiere contenido útil; no asumir funcionalidad por nombre.

19. LibRaw-Wasm — https://github.com/ybouane/LibRaw-Wasm  
    Futuro: ingest de RAW fotográfico y proxies.

## Media intelligence / editing / NLE patterns

20. video-use — https://github.com/browser-use/video-use  
    Estudiar/reutilizar: transcript compacto + filmstrip/waveform on demand, EDL, self-eval render, repair loop, audio boundary fades.

21. OpenChatCut — https://github.com/0xsline/OpenChatCut  
    Estudiar: agent-native editable timeline, proposals, plugins, sandbox, safe zones/geometry, export queue. Revisar AGPL antes de copiar.

22. Rescript — https://github.com/wassgha/rescript  
    Estudiar: Resolve/Premiere/FCPXML/AAF/RPP interchange. Revisar licencia no comercial actual antes de copiar.

23. CutScript — https://github.com/DataAnts-AI/CutScript  
    Estudiar/reutilizar si licencia permite: transcript-based editing, word timing, diarization, waveform, undo/redo.

24. Diffusion Studio Editor — https://github.com/diffusionstudio/editor  
    Estudiar: bidirectional agent↔editor, media inspection, headless runtime, asset hashes, code/editor state patterns.

25. OpenShot Qt — https://github.com/OpenShot/openshot-qt  
    Estudiar NLE behavior: tracks, snapping, keyframes, frame accuracy, EDL. Copyleft caution.

26. YFT Design — https://github.com/dromara/yft-design  
    Estudiar/reutilizar selectivamente: canvas, guides, snapping, rulers, layers, fonts, SVG/PDF patterns.

27. HyCanvas — https://github.com/hyscaler/HyCanvas  
    Estudiar: modular monorepo, brand kits, proxies, resumable uploads, open project formats. Revisar licencia antes de copiar.

28. SupoClip — https://github.com/FujiwaraChoki/supoclip  
    Estudiar: async workers, captions, B-roll, face crop, MCP/API, progress. AGPL caution.

29. ViralMint — https://github.com/openclaw-easy/ViralMint  
    Estudiar: progress/jobs, library, autosave/history, proposal-first auto-cut, modular tools. AGPL caution.

30. Clips Studio — https://github.com/ColinGPT9/clips-studio  
    Estudiar: persistent/crash-recovery state, active-speaker framing, multi-signal analysis, scheduler. AGPL caution.

31. Whisper JAX — https://github.com/sanchit-gandhi/whisper-jax  
    Estudiar como futuro transcription provider remoto/JAX; Apple Silicon local mantiene MLX/whisper.cpp como prioridad.

32. Riverside org — https://github.com/orgs/riversidefm/repositories  
    Estudiar MCP/production patterns y proyectos públicos concretos, no asumir que todo el producto es open-source.

33. Riverside clone — https://github.com/omshdev/Riverside  
    Principalmente referencia de WebRTC/recording; baja prioridad para Dresser.

34. Descript — https://www.descript.com  
35. Kapwing — https://www.kapwing.com  
36. Kapwing text editor — https://www.kapwing.com/es/ai/text-based-video-editor  
    Estudiar producto/UX: text editing, repurpose, brand kits, scene generation, safe zones, editable AI output.

## Stock / generation / enhancement

37. Freepik MCP — https://github.com/mcerqua/freepik-mcp  
    Estudiar cómo modela búsqueda, details, downloads, generation y job status. No es necesario usar el MCP; puede inspirar `FreepikProvider/AssetSearch` nativo.

38. Wireflow Freepik Spaces alternative — https://www.wireflow.ai/freepik-spaces-alternative  
    Estudiar visual workflows, publicar workflows como API/MCP y Spaces UX.

39. SUPIR — https://github.com/Fanghua-Yu/SUPIR  
    Estudiar image restoration/upscale; licencia/restricciones requieren cautela comercial.

40. Clarity Upscaler — https://github.com/philz1337x/clarity-upscaler  
    Estudiar multi-step upscaling, sharpening, ComfyUI/A1111 workflows y provider abstraction.

41. XForge — https://x-forge.dev  
    Referencia de modularidad/component boundaries; no dependencia de video.

42. OpenMolt repo — https://github.com/ybouane/OpenMolt.dev  
43. OpenMolt — https://openmolt.dev  
    Estudiar agent runtime, declarative integrations, scoped permissions y tools. Production Graph sigue siendo la verdad.

44. aPulse — https://github.com/ybouane/aPulse  
    Inspiración para Doctor/health checks/latency/provider status.

## Videos de referencia de motion/workflows

45. https://www.youtube.com/watch?v=b7KlsXNQobs  
46. https://www.youtube.com/watch?v=f393grXJn9E  
47. https://www.youtube.com/watch?v=xOhh274Ayac  
48. https://www.youtube.com/watch?v=7wuYBfE131U  
    Estudiar: script/voiceover→beats→asset sheet→scene/layers→frame choreography→Remotion render, editable props, tokens y visual consistency.

49. https://www.youtube.com/watch?v=IWA9LCvNW8g  
    Estudiar: generación text→video, reference images/ingredients, image→video, continuity, parallel generation, canvas/storyboard, long-video assembly y handoff entre plataformas. Verificar por separado cualquier claim actual de modelos/precios/límites.

## Referencias propias

50. Abrxs-Canter — https://github.com/LordJeferies/Abrxs-Canter  
51. Abrxs-Review — https://github.com/LordJeferies/Abrxs-Review  
52. Abrxs-Review público — https://lordjeferies.github.io/Abrxs-Review/  
53. Abraxas OS — https://github.com/LordJeferies/abraxas-os  

## Regla de uso de estas fuentes

No copiar “apps completas”. Identificar unidades útiles: contrato, data model, worker, UX pattern, renderer component, parser, timeline behavior, provider adapter, template structure o test strategy. Documentar en cada PR de reutilización: URL, commit, archivos inspirados/copied, licencia y modificaciones.

## Referencia adicional confirmada por el usuario

54. Yassine Bouanane — https://github.com/ybouane
    Índice de autor para ubicar los proyectos concretos VideoFlow, LiquidGlass,
    LibRaw-Wasm, aPulse y OpenMolt. No copiar un perfil ni tratar todo su contenido
    como una sola dependencia/licencia.

La tabla de 46 enlaces reenviada por el usuario el 2026-10-02 queda cubierta por
esta matriz (incluidos los cuatro videos Remotion y el índice del autor). Los enlaces
se conservan sin parámetros de tracking. La lista no significa auditoría completa;
revisión profunda y licencia se fijan al implementar la capacidad correspondiente.
