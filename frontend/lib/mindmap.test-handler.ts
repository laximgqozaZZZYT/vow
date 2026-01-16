// テスト用のハンドラーを組み込み
export const initializeMindmapTestHandler = () => {
  if (typeof window === 'undefined') return;

  class MindmapTestHandler {
    constructor() {
      this.setupMessageListener();
    }

    setupMessageListener() {
      window.addEventListener('message', (event) => {
        const data = event.data;

        switch (data.type) {
          case 'CHECK_EDITING_STATE':
            this.handleCheckEditingState(data.testType);
            break;
        }
      });
    }

    sendMessage(type: string, data: any = {}) {
      try {
        window.parent.postMessage({
          type: type,
          ...data,
          timestamp: Date.now()
        }, '*');
      } catch (error) {
        console.error('Failed to send message to parent:', error);
      }
    }

    handleCheckEditingState(testType: string) {
      const input = document.querySelector('input.mindmap-text-input') as HTMLInputElement;
      const isEditing = !!input && (input as any).offsetParent !== null;
      
      this.sendMessage('EDITING_STATE_RESULT', {
        isEditing: isEditing,
        testType: testType,
        nodeId: '1',
        hasInput: !!input,
        inputVisible: input ? (input as any).offsetParent !== null : false
      });
    }

    findNode(nodeId: string) {
      // data-idでノードを探す
      let node = document.querySelector(`[data-id="${nodeId}"]`) ||
                document.querySelector(`[data-testid="mindmap-node-${nodeId}"]`);
      
      if (!node) {
        // React Flowのノードを探す
        const reactFlowNodes = document.querySelectorAll('[class*="react-flow__node"]');
        for (let reactNode of reactFlowNodes) {
          if (reactNode.textContent?.includes('Central Idea') && nodeId === '1') {
            node = reactNode;
            break;
          }
        }
      }
      
      return node;
    }
  }

  // テストハンドラーを初期化
  if (!(window as any).mindmapTestHandler) {
    (window as any).mindmapTestHandler = new MindmapTestHandler();
  }
};
