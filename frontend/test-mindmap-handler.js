// Mindmap編集機能テスト用のハンドラー
// このスクリプトをMindmapコンポーネントに組み込んで使用します

class MindmapTestHandler {
    constructor() {
        this.isTestMode = false;
        this.setupMessageListener();
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // テストページからのメッセージのみ処理
            if (event.origin !== window.location.origin && 
                event.origin !== 'http://localhost:3000') {
                return;
            }

            const data = event.data;
            console.log('Received test message:', data);

            switch (data.type) {
                case 'OPEN_MINDMAP':
                    this.handleOpenMindmap();
                    break;
                case 'TEST_NODE_CLICK':
                    this.handleTestNodeClick(data.nodeId);
                    break;
                case 'TEST_NODE_DOUBLE_CLICK':
                    this.handleTestNodeDoubleClick(data.nodeId);
                    break;
                case 'TEST_RIGHT_CLICK_EDIT':
                    this.handleTestRightClickEdit(data.nodeId);
                    break;
                case 'TEST_KEYBOARD_EDIT':
                    this.handleTestKeyboardEdit(data.nodeId, data.keys);
                    break;
                case 'CHECK_EDITING_STATE':
                    this.handleCheckEditingState(data.testType);
                    break;
            }
        });
    }

    sendMessage(type, data = {}) {
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

    handleOpenMindmap() {
        console.log('Opening mindmap for test...');
        
        // Mindmapを開くボタンを探してクリック
        const mindmapButton = document.querySelector('[data-testid="mindmap-button"]') ||
                             document.querySelector('button:contains("Mindmap")') ||
                             document.querySelector('button[title*="mindmap" i]');
        
        if (mindmapButton) {
            mindmapButton.click();
            this.sendMessage('MINDMAP_OPENED');
            console.log('Mindmap button clicked');
        } else {
            // 直接Mindmapコンポーネントが表示されているかチェック
            const mindmapEditor = document.querySelector('[class*="mindmap" i]') ||
                                 document.querySelector('[data-testid="mindmap-editor"]');
            
            if (mindmapEditor) {
                this.sendMessage('MINDMAP_OPENED');
                console.log('Mindmap editor already visible');
            } else {
                this.sendMessage('TEST_ERROR', { error: 'Mindmap button not found' });
                console.error('Mindmap button not found');
            }
        }
    }

    handleTestNodeClick(nodeId) {
        console.log(`Testing node click for node: ${nodeId}`);
        
        const node = this.findNode(nodeId);
        if (node) {
            // シングルクリックをシミュレート
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            node.dispatchEvent(clickEvent);
            console.log('Node click event dispatched');
            
            this.sendMessage('DEBUG_INFO', { 
                message: `Node ${nodeId} clicked, waiting for editing state...` 
            });
        } else {
            this.sendMessage('TEST_ERROR', { 
                error: `Node ${nodeId} not found` 
            });
        }
    }

    handleTestNodeDoubleClick(nodeId) {
        console.log(`Testing node double click for node: ${nodeId}`);
        
        const node = this.findNode(nodeId);
        if (node) {
            // ダブルクリックをシミュレート
            const dblClickEvent = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            node.dispatchEvent(dblClickEvent);
            console.log('Node double click event dispatched');
            
            this.sendMessage('DEBUG_INFO', { 
                message: `Node ${nodeId} double-clicked, waiting for editing state...` 
            });
        } else {
            this.sendMessage('TEST_ERROR', { 
                error: `Node ${nodeId} not found` 
            });
        }
    }

    handleTestRightClickEdit(nodeId) {
        console.log(`Testing right click edit for node: ${nodeId}`);
        
        const node = this.findNode(nodeId);
        if (node) {
            // 右クリックをシミュレート
            const rightClickEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2
            });
            
            node.dispatchEvent(rightClickEvent);
            console.log('Node right click event dispatched');
            
            // 少し待ってから「Edit Text」メニューをクリック
            setTimeout(() => {
                const editTextButton = document.querySelector('button:contains("Edit Text")') ||
                                     document.querySelector('[data-testid="edit-text-button"]');
                
                if (editTextButton) {
                    editTextButton.click();
                    console.log('Edit Text button clicked');
                } else {
                    this.sendMessage('TEST_ERROR', { 
                        error: 'Edit Text button not found in context menu' 
                    });
                }
            }, 100);
            
        } else {
            this.sendMessage('TEST_ERROR', { 
                error: `Node ${nodeId} not found` 
            });
        }
    }

    handleTestKeyboardEdit(nodeId, keys) {
        console.log(`Testing keyboard edit for node: ${nodeId} with keys:`, keys);
        
        // まずノードをクリックして編集モードにする
        this.handleTestNodeClick(nodeId);
        
        setTimeout(() => {
            const input = document.querySelector('input[class*="mindmap-text-input"]') ||
                         document.querySelector('input[type="text"]') ||
                         document.querySelector('textarea');
            
            if (input) {
                keys.forEach((key, index) => {
                    setTimeout(() => {
                        const keyEvent = new KeyboardEvent('keydown', {
                            key: key,
                            bubbles: true,
                            cancelable: true
                        });
                        
                        input.dispatchEvent(keyEvent);
                        console.log(`Key ${key} dispatched`);
                    }, index * 100);
                });
            } else {
                this.sendMessage('TEST_ERROR', { 
                    error: 'Input field not found for keyboard test' 
                });
            }
        }, 500);
    }

    handleCheckEditingState(testType) {
        console.log(`Checking editing state for test: ${testType}`);
        
        // 編集中の入力フィールドを探す
        const input = document.querySelector('input[class*="mindmap-text-input"]') ||
                     document.querySelector('input[type="text"]') ||
                     document.querySelector('textarea');
        
        const isEditing = !!input && input.style.display !== 'none';
        
        // ノードの状態も確認
        const editingNode = document.querySelector('[class*="editing"]') ||
                           document.querySelector('[data-editing="true"]');
        
        this.sendMessage('EDITING_STATE_RESULT', {
            isEditing: isEditing,
            testType: testType,
            nodeId: '1', // テスト対象ノード
            hasInput: !!input,
            inputVisible: input ? input.style.display !== 'none' : false,
            editingNodeFound: !!editingNode
        });
        
        // デバッグ情報も送信
        this.sendMessage('DEBUG_INFO', {
            message: `Editing state: ${isEditing}, Input found: ${!!input}, Editing node: ${!!editingNode}`
        });
    }

    findNode(nodeId) {
        // 様々な方法でノードを探す
        let node = document.querySelector(`[data-id="${nodeId}"]`) ||
                  document.querySelector(`[id="${nodeId}"]`) ||
                  document.querySelector(`[data-node-id="${nodeId}"]`);
        
        if (!node) {
            // React Flowのノードを探す
            const reactFlowNodes = document.querySelectorAll('[class*="react-flow__node"]');
            for (let reactNode of reactFlowNodes) {
                if (reactNode.textContent.includes('Central Idea') && nodeId === '1') {
                    node = reactNode;
                    break;
                }
            }
        }
        
        if (!node) {
            // テキスト内容でノードを探す
            const allDivs = document.querySelectorAll('div');
            for (let div of allDivs) {
                if (div.textContent.trim() === 'Central Idea' && nodeId === '1') {
                    node = div;
                    break;
                }
            }
        }
        
        console.log(`Node ${nodeId} found:`, node);
        return node;
    }
}

// グローバルに利用可能にする
window.MindmapTestHandler = MindmapTestHandler;

// 自動初期化
if (typeof window !== 'undefined') {
    window.mindmapTestHandler = new MindmapTestHandler();
    console.log('Mindmap test handler initialized');
}

export default MindmapTestHandler;