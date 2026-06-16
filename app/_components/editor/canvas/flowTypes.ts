import EndNode from '../../nodes/EndNode';
import SceneNode from '../../nodes/SceneNode';
import StartNode from '../../nodes/StartNode';
import ComfyEdge from '../ComfyEdge';

export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  scene: SceneNode,
};

export const edgeTypes = {
  comfy: ComfyEdge,
};
