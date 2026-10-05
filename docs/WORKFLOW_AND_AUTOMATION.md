# Workflow Studio y automatización audiovisual

No es un n8n genérico. Solo orquesta procesos de contenido/video.

## Base UI
XYFlow/React Flow para mapa de recipes. El timeline sigue siendo otra UI.

## Nodos de dominio

Input: Video, Image, Audio, Transcript, Script, Project, Client.  
Analysis: Transcript, Scene, Face, Geometry, Visual Opportunity.  
AI: LLM, Generate Image/Video/Audio, Enhance.  
Media: Stock Search, Frame Grab, Trim, Stitch, Upscale.  
Abraxas: Broll Plan, XR Plan, Caption Plan, Add to Graph, Render Piece, QA.  
Logic: Array, Router, Switch, Condition, Retry, Human Approval.  
Output: MP4, Asset, Graph, DaVinci, Delivery.

## Principios tomados de herramientas tipo Node Banana/Langflow/n8n

- topological execution;
- typed handles;
- array/batch;
- conditional routing;
- retry/error branches;
- human-in-the-loop checkpoints;
- resumable state;
- execution history;
- cost/provider metadata;
- recipes serializables.

## Separación

Workflow genera jobs/operations contra Production Graph. No mantiene una segunda verdad del proyecto.
