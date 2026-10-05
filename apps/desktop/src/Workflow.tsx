import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react';
const nodes: Node[] = [
  {id:'1', position:{x:0,y:80}, data:{label:'20 clips'}, type:'input'},
  {id:'2', position:{x:180,y:80}, data:{label:'Transcript'}},
  {id:'3', position:{x:360,y:80}, data:{label:'Visual Plan'}},
  {id:'4', position:{x:540,y:20}, data:{label:'Stock Search'}},
  {id:'5', position:{x:540,y:140}, data:{label:'AI Image'}},
  {id:'6', position:{x:720,y:80}, data:{label:'Add to Graph'}},
  {id:'7', position:{x:900,y:80}, data:{label:'Render + QA'}, type:'output'}
];
const edges: Edge[] = [
  {id:'e12',source:'1',target:'2'}, {id:'e23',source:'2',target:'3'},
  {id:'e34',source:'3',target:'4'}, {id:'e35',source:'3',target:'5'},
  {id:'e46',source:'4',target:'6'}, {id:'e56',source:'5',target:'6'}, {id:'e67',source:'6',target:'7'}
];

export default function Workflow(){return <div className="content"><section className="hero compact glass"><div><p className="eyebrow">PROTOTYPE</p><h2>Workflow Studio</h2><p>XYFlow se usa para recipes y automatización audiovisual, no para reemplazar el timeline.</p></div></section><section className="flow-wrap glass"><ReactFlow nodes={nodes} edges={edges} fitView><Background/><MiniMap/><Controls/></ReactFlow></section></div>}

