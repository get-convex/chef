// All Chef projects created after May 1 2025 dynamically link this script, so be careful when modifying it.
import { toPng } from 'html-to-image';

export async function respondToMessage(message: MessageEvent) {
  // These checks should already have been made before loading this module.
  // Make them here again because they're really important.
  if (message.source !== window.parent) {
    return;
  }
  if (message.data.type !== 'chefPreviewRequest') {
    return;
  }
  if (message.data.request === 'screenshot') {
    const imageData = await toPng(document.body);
    message.source.postMessage({ type: 'screenshot', data: imageData }, message.origin);
  }
}
