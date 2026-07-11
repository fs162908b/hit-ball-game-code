import { _decorator, Component, EventTouch, instantiate, Node, PhysicsSystem2D, Prefab, RigidBody2D, Vec2, Vec3, UITransform, Collider2D, Contact2DType, director, Label, tween, Graphics, Color, ERaycast2DType, Sprite, Button, BlockInputEvents, UIOpacity, AudioSource, AudioClip } from 'cc';
import { Block } from './Block'; // 👈 導入 Block 腳本以進行控制
const { ccclass, property } = _decorator;

@ccclass('GameArea')
export class GameArea extends Component {

    public static instance: GameArea = null!; // 👈 宣告全域單例

    @property(Prefab)
    ballPrefab: Prefab = null!; // 綁定剛才做好的彈珠 Prefab

    @property(Prefab)
    blockPrefab: Prefab = null!; // 👈 綁定方塊 Prefab

    @property(Node)
    blocksContainer: Node = null!; // 👈 綁定方塊容器節點 (若無則使用本節點)

    @property(Node)
    shooterNode: Node = null!; // 👈 綁定砲台節點

    @property
    shootSpeed: number = 100; // 👈 彈珠發射速度

    // 🎵 音效資源綁定
    @property(AudioClip)
    shootSound: AudioClip = null!; // 👈 拖曳綁定發射彈珠音效

    @property(AudioClip)
    hitSound: AudioClip = null!; // 👈 拖曳綁定方塊碰撞音效

    @property(AudioClip)
    buySound: AudioClip = null!; // 👈 拖曳綁定金幣購買音效

    @property(AudioClip)
    gameOverSound: AudioClip = null!; // 👈 拖曳綁定遊戲結束音效

    @property(AudioClip)
    clickSound: AudioClip = null!; // 👈 拖曳綁定按鈕點擊音效

    // 🏆 UI 顯示與繪圖組件
    @property(Label)
    roundLabel: Label = null!; // 👈 顯示目前回合數的 Label

    @property(Label)
    bulletCountLabel: Label = null!; // 👈 顯示目前彈珠數量的 Label

    @property(Label)
    coinsLabel: Label = null!; // 👈 顯示目前金錢數量的 Label

    @property(Node)
    gameOverPanel: Node = null!; // 👈 綁定您在編輯器中設計好的 GameOver 結算面板

    @property(Label)
    gameOverRoundLabel: Label = null!; // 👈 綁定顯示結算回合數的 Label

    @property(Label)
    gameOverCoinsLabel: Label = null!; // 👈 綁定顯示結算金錢數量的 Label

    @property(Label)
    gameOverHitLabel: Label = null!; // 👈 顯示結算總撞擊次數的 Label

    @property(Label)
    scoreLabel: Label = null!; // 👈 遊戲進行中即時顯示總分數 (撞擊次數) 的 Label

    private aimGraphics: Graphics = null!; // 👈 用於動態繪製瞄準線的組件

    // 🏆 遊戲狀態數據
    public round: number = 1; // 當前輪數/回合數
    public coins: number = 0; // 玩家金錢
    public bulletCount: number = 1; // 玩家擁有的彈珠總數 (初始為 1)
    public hitCount: number = 0; // 👈 累計彈珠碰撞方塊的總次數 (分數)
    
    private activeBullets: number = 0; // 當前畫面上活耀認得彈珠數量
    private isShooting: boolean = false; // 是否處於連發狀態中 (防止連點)
    private isAiming: boolean = false; // 👈 記錄當前是否正在拖動瞄準
    private isAimCancel: boolean = false; // 👈 記錄目前是否因為移出區域而取消發射
    private currentAimDirection: Vec2 = new Vec2(0, 1); // 👈 存儲當前瞄準方向
    private blocksList: Node[] = []; // 存儲場景中所有活躍方塊的節點
    private localAudioSource: AudioSource = null!; // 👈 用於播放音效的 AudioSource 元件
    private isExiting: boolean = false; // 👈 防止重複點擊返回選單旗標

    onLoad() {
        GameArea.instance = this; // 👈 初始化單例
        
        // 💡 取得或動態掛載 AudioSource 元件
        this.localAudioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);

        // 1. 啟用 2D 物理系統
        PhysicsSystem2D.instance.enable = true;

        // 💡 建立專屬的「瞄準線繪製節點」並確保它置於最上層
        // 因為在 Cocos 2D 中，子節點會蓋在父節點 Graphics 上。我們建立一個專屬子節點並將層級（SiblingIndex）設為最大，
        // 這樣線條就會被畫在所有方塊、彈珠的最上方，絕對不會被蓋住！
        let lineNode = this.node.getChildByName("AimLineNode");
        if (!lineNode) {
            lineNode = new Node("AimLineNode");
            this.node.addChild(lineNode);
        }
        lineNode.setSiblingIndex(9999); // 確保在最後繪製（最上層）
        this.aimGraphics = lineNode.getComponent(Graphics) || lineNode.addComponent(Graphics);

        // 💡 雙重不區分大小寫搜尋 Ground 節點
        let groundNode = this.node.children.find(c => c.name.toLowerCase() === "ground");
        if (!groundNode && this.node.parent) {
            groundNode = this.node.parent.children.find(c => c.name.toLowerCase() === "ground");
        }

        if (groundNode) {
            console.log(`🟢 [偵測成功] 已定位 Ground 節點："${groundNode.name}"`);
            let groundCollider = groundNode.getComponent(Collider2D);
            if (groundCollider) {
                (groundCollider as any).sensor = true; // 強制設為感應器
                (groundCollider as any).enabledContactListener = true; // 強制啟用監聽
                console.log("🟢 [設定成功] 已為 Ground 強制啟用 Sensor 與碰撞監聽！");
            } else {
                console.error("🔴 [設定失敗] 找到了 Ground 節點，但該節點上【沒有掛載 BoxCollider2D】組件！請在屬性檢查器中為其添加 BoxCollider2D。");
            }
        } else {
            console.error("🔴 [設定失敗] 在場景中【完全找不到】任何名為 'Ground' 或 'ground' 的節點！請確認它是否為 GameArea 或是 Canvas 的子節點。");
        }

        // 💡 建立並繪製死亡線節點 (位於 Y = -300 處)
        let deathLineNode = this.node.getChildByName("DeathLineNode");
        if (!deathLineNode) {
            deathLineNode = new Node("DeathLineNode");
            this.node.addChild(deathLineNode);
        }
        deathLineNode.setSiblingIndex(9998); // 稍微低於瞄準線，但在背景和方塊之上
        let deathGraphics = deathLineNode.getComponent(Graphics) || deathLineNode.addComponent(Graphics);
        deathGraphics.clear();
        deathGraphics.lineWidth = 6; // 👈 寬度加粗為 6 像素，更加醒目！
        deathGraphics.strokeColor = new Color(255, 50, 50, 120); // 警示紅色
        deathGraphics.moveTo(-300, -300);
        deathGraphics.lineTo(300, -300);
        deathGraphics.stroke();

        // 💡 監聽全域碰撞事件（用來回收彈珠）
        PhysicsSystem2D.instance.on(Contact2DType.BEGIN_CONTACT, this.onGlobalBeginContact, this);
    }

    start() {
        // 2. 監聽拖曳瞄準相關的觸摸事件 (TOUCH_START 按住, TOUCH_MOVE 拖動, TOUCH_END 放開)
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

        // 3. 遊戲開始，先在最頂部生成第一排方塊
        this.spawnNewRow();

        // 💡 初始化 UI 文字顯示
        this.updateGameUI();

        // 💡 防呆機制：確保遊戲一開始時，GameOver 面板是處於隱藏狀態的
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
    }

    onDestroy() {
        if (PhysicsSystem2D.instance) {
            PhysicsSystem2D.instance.off(Contact2DType.BEGIN_CONTACT, this.onGlobalBeginContact, this);
        }
        if (this.node) {
            this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        }
    }

    // 💡 全域碰撞事件 (偵測是否撞擊到底部地面)
    private onGlobalBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: any) {
        // 🔍 診斷日誌：無條件印出所有發生的物理碰撞，幫我們確認到底是「名字對不上」還是「根本沒有碰撞」
        console.log(`💥 [全域物理偵測] 碰撞發生！「${selfCollider.node.name}」與「${otherCollider.node.name}」相撞`);

        let selfName = selfCollider.node.name.toLowerCase();
        let otherName = otherCollider.node.name.toLowerCase();

        // 💡 容錯機制：使用 toLowerCase() 防止因為大小寫不同而偵測不到碰撞
        if (selfName.includes("ground") || otherName.includes("ground")) {
            // 找出撞擊地面的另一個碰撞體節點
            let targetNode = selfName.includes("ground") ? otherCollider.node : selfCollider.node;
            
            // 檢查撞擊地面的是否是彈珠 (startsWith("ball") 可以相容 Ball, ball, Ball(Clone)...)
            if (targetNode.name.toLowerCase().startsWith("ball")) {
                this.recycleBall(targetNode);
            }
        }
    }

    // 💡 回收彈珠的方法
    private recycleBall(ballNode: Node) {
        // 💡 先記錄此彈珠消失前的 X 座標
        let dropX = ballNode.position.x;

        // 延遲到下一幀銷毀，避開物理世界鎖定崩潰
        setTimeout(() => {
            if (ballNode && ballNode.isValid) {
                ballNode.destroy();
                this.activeBullets--;
                console.log(`📥 彈珠回收，目前畫面上還剩：${this.activeBullets} 顆`);
                
                // 當發射的所有彈珠都回到地面被回收後，進入下一回合
                if (this.activeBullets === 0 && this.isShooting) {
                    // 💡 砲台移動到最後一顆彈珠落地的 X 座標 (僅移動橫軸)
                    this.moveShooterTo(dropX);
                    this.nextRound();
                }
            }
        }, 0);
    }

    // 💡 平滑移動砲台至新位置 (只移動 X 軸)
    private moveShooterTo(targetX: number) {
        // 限制砲台位置在遊戲區域範圍內，避免一半圖片滑進牆壁 (GameArea 寬度是 600，X 範圍在 -300 到 300)
        let minX = -270;
        let maxX = 270;
        let safeX = Math.max(minX, Math.min(maxX, targetX));

        console.log(`🎯 [砲台定位] 移動至最後彈珠回收位置：X = ${safeX.toFixed(1)}`);

        // 使用 tween 平滑移動砲台的橫軸，保持其原本的 Y 軸不變
        tween(this.shooterNode)
            .to(0.3, { position: new Vec3(safeX, this.shooterNode.position.y, 0) }, { easing: 'quadOut' })
            .start();
    }

    // 💡 觸摸按住事件 (開始瞄準)
    onTouchStart(event: EventTouch) {
        if (this.isShooting) return;
        this.updateAim(event.getUILocation()); // 👈 使用 getUILocation 獲取精確適配後的 UI 世界座標
    }

    // 💡 觸摸拖曳事件 (移動瞄準)
    onTouchMove(event: EventTouch) {
        if (this.isShooting) return;
        this.updateAim(event.getUILocation()); // 👈 使用 getUILocation 獲取精確適配後的 UI 世界座標
    }

    // 💡 觸摸結束放開事件 (發射子彈)
    onTouchEnd(event: EventTouch) {
        this.endAimAndShoot();
    }

    // 💡 觸摸被系統取消事件 (例如電話打來)
    onTouchCancel(event: EventTouch) {
        this.endAimAndShoot();
    }

    // 💡 更新瞄準參數與呼叫繪圖
    private updateAim(touchWorldPos: Vec2) {
        this.isAiming = true;

        let uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            // 將點擊的世界座標轉成 GameArea 本地座標
            let localTouchPos = uiTransform.convertToNodeSpaceAR(new Vec3(touchWorldPos.x, touchWorldPos.y, 0));
            
            // 💡 檢查滑鼠是否滑出了 GameArea 遊戲區塊範圍 (GameArea 的寬/高)
            let isInside = Math.abs(localTouchPos.x) <= uiTransform.width / 2 && 
                           Math.abs(localTouchPos.y) <= uiTransform.height / 2;

            if (!isInside) {
                // 💡 移出區域：取消指示線，並標記此次發射取消
                this.isAimCancel = true;
                if (this.aimGraphics) {
                    this.aimGraphics.clear();
                }
                return;
            }

            // 💡 移回區域：重新恢復發射權
            this.isAimCancel = false;

            let shooterPos = this.shooterNode.position;

            // 計算發射向量 (滑鼠位置 - 砲台位置)
            let direction = new Vec2(localTouchPos.x - shooterPos.x, localTouchPos.y - shooterPos.y);
            direction.normalize();

            // 限制發射角度：仰角小於一定角度 (例如水平面之上 0.1) 時，強行鎖定最小發射角，防止朝左右正下方發射
            if (direction.y < 0.15) {
                direction.set(direction.x > 0 ? 0.988 : -0.988, 0.15);
                direction.normalize();
            }

            this.currentAimDirection = direction;

            // 繪製指示線
            this.drawAimLine(direction);
        }
    }

    // 💡 繪製射線與瞄準虛線
    private drawAimLine(direction: Vec2) {
        if (!this.aimGraphics) return;

        // 💡 每次畫線前，強制把繪圖節點拉到所有子節點的最上層，防止被剛生成的方塊或彈珠插隊蓋住！
        this.aimGraphics.node.setSiblingIndex(9999);
        
        this.aimGraphics.clear(); // 清空上一幀的線條

        // 1. 取得發射起點 (砲台的世界座標)
        let startWorldV3 = this.shooterNode.worldPosition;
        let startWorld = new Vec2(startWorldV3.x, startWorldV3.y);

        // 2. 計算一個超級長的虛擬射線終點 (世界座標)
        let rayLength = 2000;
        let endWorld = startWorld.clone().add(direction.clone().multiplyScalar(rayLength));

        // 3. 執行物理 Closest 射線檢測，尋找第一個碰到的碰撞體
        let results = PhysicsSystem2D.instance.raycast(startWorld, endWorld, ERaycast2DType.Closest);
        
        let hitWorld = endWorld;
        if (results.length > 0) {
            hitWorld = results[0].point; // 取得第一個相撞點的世界座標
        }

        // 4. 將世界座標轉換為 GameArea 本地座標以利繪製
        let uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            let startLocal = this.shooterNode.position.clone();
            let hitLocal = uiTransform.convertToNodeSpaceAR(new Vec3(hitWorld.x, hitWorld.y, 0));

            // 設定線條樣式 (半透明紅色虛線，線寬 4 像素)
            this.aimGraphics.lineWidth = 4;
            this.aimGraphics.strokeColor = new Color(255, 50, 50, 180); // 👈 設為紅色

            // 繪製虛線邏輯 (Dashed Line)
            let distance = Vec3.distance(startLocal, hitLocal);
            let dir = new Vec3();
            Vec3.subtract(dir, hitLocal, startLocal);
            dir.normalize();

            let step = 15; // 每個虛線線段與間隔長度
            let currentDist = 0;
            let shouldDraw = true;

            while (currentDist < distance) {
                let nextDist = currentDist + step;
                if (nextDist > distance) {
                    nextDist = distance;
                }

                let p1 = startLocal.clone().add(dir.clone().multiplyScalar(currentDist));
                let p2 = startLocal.clone().add(dir.clone().multiplyScalar(nextDist));

                if (shouldDraw) {
                    this.aimGraphics.moveTo(p1.x, p1.y);
                    this.aimGraphics.lineTo(p2.x, p2.y);
                }

                shouldDraw = !shouldDraw; // 畫一段、空一段
                currentDist = nextDist;
            }

            this.aimGraphics.stroke(); // 正式渲染出來
        }
    }

    // 💡 結束瞄準並射出彈珠
    private endAimAndShoot() {
        if (!this.isAiming) return;
        this.isAiming = false;

        // 1. 清空瞄準線
        if (this.aimGraphics) {
            this.aimGraphics.clear();
        }

        // 2. 觸發射擊 (如果被移出區取消，則不執行發射)
        if (!this.isShooting && !this.isAimCancel) {
            this.shootBulletsChain(this.currentAimDirection);
        }

        // 💡 每次放開時，不管有沒有發射都將取消標記重置
        this.isAimCancel = false;
    }



    // 💡 連發子彈計時器
    private shootBulletsChain(direction: Vec2) {
        this.isShooting = true;
        this.activeBullets = this.bulletCount; // 本次發射的總顆數
        let shootCount = 0;
        
        // 💡 追蹤目前剩餘未發射的數量
        let remainingBullets = this.bulletCount;

        console.log(`🚀 發射彈珠！數量：${this.bulletCount} 顆，目前回合：${this.round}`);

        // 使用 Cocos 定時器，以 0.15 秒為間隔連發
        let shootFunc = () => {
            if (!this.isValid) return;

            let ball = instantiate(this.ballPrefab);
            this.node.addChild(ball);
            ball.setPosition(this.shooterNode.position);
            
            // 💡 播放發射彈珠音效
            this.playSound(this.shootSound, 0.45);

            // 程式碼強制啟用該彈珠的碰撞監聽
            let ballCollider = ball.getComponent(Collider2D);
            if (ballCollider) {
                (ballCollider as any).enabledContactListener = true;
            }

            let rigidBody = ball.getComponent(RigidBody2D);
            if (rigidBody) {
                rigidBody.linearVelocity = direction.clone().multiplyScalar(this.shootSpeed);
            }

            shootCount++;

            // 💡 每發射一顆，未發射數量 -1，並即時更新畫面的球數顯示
            remainingBullets--;
            if (this.bulletCountLabel) {
                this.bulletCountLabel.string = `BALLS: x${remainingBullets}`;
            }

            if (shootCount >= this.bulletCount) {
                this.unschedule(shootFunc); // 連發結束，停止定時器
            }
        };

        // 立即發射第一顆，隨後以 0.15 秒重複發射
        shootFunc();
        if (this.bulletCount > 1) {
            this.schedule(shootFunc, 0.15, this.bulletCount - 2);
        }
    }

    // 💡 增加玩家金幣
    public addCoins(amount: number) {
        this.coins += amount;
        console.log(`💰 金錢增加！獲得 +${amount} 金幣。目前擁有金幣：${this.coins}`);
        this.updateGameUI(); // 👈 更新 UI 顯示
    }

    // 💡 進入下一回合
    private nextRound() {
        this.isShooting = false;
        this.round++;
        // 每過一回合，彈珠總數 +1（打磚塊遊戲常規設定，越玩子彈越多越爽快）
        this.bulletCount++;

        console.log(`🔄 回合結束，進入第 ${this.round} 回合！彈珠上限提升至：${this.bulletCount}`);

        // 1. 將所有存活的方塊往下移動一排
        this.moveBlocksDown();

        // 2. 在最頂部生成新一排方塊
        this.spawnNewRow();

        this.updateGameUI(); // 👈 更新 UI 顯示
    }

    // 💡 更新 UI 文字顯示
    private updateGameUI() {
        if (this.roundLabel) {
            this.roundLabel.string = `ROUND: ${this.round}`;
        }
        if (this.bulletCountLabel) {
            this.bulletCountLabel.string = `BALLS: x${this.bulletCount}`;
        }
        if (this.coinsLabel) {
            this.coinsLabel.string = `COINS: $${this.coins}`;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = this.hitCount.toString(); // 👈 遊戲中即時顯示分數
        }
    }

    // 💡 將現有方塊全部往下移一格，並檢測死亡線
    private moveBlocksDown() {
        let isGameOver = false;

        for (let i = this.blocksList.length - 1; i >= 0; i--) {
            let blockNode = this.blocksList[i];
            if (blockNode && blockNode.isValid) {
                let blockComp = blockNode.getComponent(Block);
                if (blockComp) {
                    blockComp.row++; // 網格行數 +1
                    blockComp.updatePosition(true); // 平滑移動

                    // 當方塊移動到第 8 行或更低，判定入侵底部安全區，遊戲結束
                    if (blockComp.row >= 8) {
                        isGameOver = true;
                    }
                }
            } else {
                this.blocksList.splice(i, 1); // 移除非活躍節點
            }
        }

        if (isGameOver) {
            this.handleGameOver();
        }
    }

    // 💡 在最頂層 (row = 0) 生成新一排方塊
    private spawnNewRow() {
        // 水平共有 6 個網格位置 (col 0 ~ 5)
        let cols = [0, 1, 2, 3, 4, 5];
        
        // 隨機洗牌，挑選位置
        for (let i = cols.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cols[i], cols[j]] = [cols[j], cols[i]];
        }

        // 隨機決定這一排生成 2 到 4 個方塊
        let count = Math.floor(Math.random() * 3) + 2; 

        let parentNode = this.blocksContainer ? this.blocksContainer : this.node;

        for (let i = 0; i < count; i++) {
            let col = cols[i];
            let blockNode = instantiate(this.blockPrefab);
            parentNode.addChild(blockNode);

            let blockComp = blockNode.getComponent(Block);
            if (blockComp) {
                blockComp.row = 1; // 💡 初始生成在第 1 行（將最頂部第 0 行空出來）
                blockComp.col = col;
                blockComp.updatePosition(false); // 初始直接跳轉位置，不用平滑移動
                
                // 方塊血量與目前回合數掛鉤 (設定為回合數 * 2)
                blockComp.init(this.round * 2);
                
                this.blocksList.push(blockNode);
            }
        }
    }

    // 💡 處理遊戲結束
    private handleGameOver() {
        console.log("💀💀💀 GAME OVER！方塊觸及底部死亡線！ 💀💀💀");
        
        // 💡 播放遊戲結束音效
        this.playSound(this.gameOverSound, 0.8);

        // 1. 登出點擊發射觸控事件，避免在 GameOver 狀態下還能拖曳畫線
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);

        // 2. 顯示編輯器中設計好的 GameOver 面板，並做淡入動畫
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;

            // 💡 如果面板掛載了 UIOpacity 組件，我們來做個淡入動畫
            let opacityComp = this.gameOverPanel.getComponent(UIOpacity);
            if (opacityComp) {
                opacityComp.opacity = 0;
                tween(opacityComp)
                    .to(0.4, { opacity: 255 })
                    .start();
            }
        } else {
            console.error("🔴 [GameOver 錯誤] 遊戲已結束，但您尚未在編輯器中的 GameArea 腳本組件上綁定【GameOverPanel】節點！請拖曳綁定它！");
        }

        // 3. 將最終戰績渲染到面板的標籤上
        if (this.gameOverRoundLabel) {
            this.gameOverRoundLabel.string = this.round.toString();
        } else {
            console.warn("⚠️ [GameOver 警報] 尚未綁定【GameOverRoundLabel】！");
        }

        if (this.gameOverCoinsLabel) {
            this.gameOverCoinsLabel.string = this.coins.toString();
        } else {
            console.warn("⚠️ [GameOver 警報] 尚未綁定【GameOverCoinsLabel】！");
        }

        if (this.gameOverHitLabel) {
            this.gameOverHitLabel.string = `分數: ${this.hitCount}`; // 👈 加上「分數:」字樣
        } else {
            console.warn("⚠️ [GameOver 警報] 尚未綁定【GameOverHitLabel】！");
        }
    }

    // 💡 增加撞擊次數 (由方塊 Block 腳本碰撞時呼叫)
    public addHitCount() {
        this.hitCount++;
        console.log(`🎯 撞擊次數增加！目前累計撞擊：${this.hitCount} 次`);
        
        if (this.scoreLabel) {
            this.scoreLabel.string = this.hitCount.toString(); // 👈 即時更新遊戲中畫面的分數顯示
        }
    }

    // 💡 當玩家點選結算面板上的返回主選單按鈕時呼叫 (可在編輯器按鈕組件中點擊事件綁定)
    public onBackToMenuBtnClick() {
        if (this.isExiting) return;
        this.isExiting = true;

        console.log("👉 點擊返回主選單，正載入 MenuScene...");
        
        // 💡 播放點擊按鈕音效
        this.playSound(this.clickSound, 1.0);

        // 💡 立即載入場景，不再人工延遲
        director.loadScene("MenuScene", (err) => {
            if (err) {
                console.error("載入 MenuScene 失敗:", err);
                this.isExiting = false; // 失敗時解鎖
            }
        });
    }

    // 💡 當玩家點選「購買彈珠」按鈕時呼叫 (3金幣買 1 顆球，可在編輯器按鈕事件綁定)
    public onBuyBallBtnClick() {
        // 如果正在連發射擊中，禁止購買
        if (this.isShooting) {
            console.log("🚫 發射彈珠中，無法購買！");
            return;
        }

        const cost = 3; // 買一顆球花費 3 金幣
        if (this.coins >= cost) {
            this.coins -= cost; // 扣除金幣
            this.bulletCount++; // 彈珠總數 +1
            console.log(`🛒 購買成功！扣除 ${cost} 金幣，彈珠上限提升至：${this.bulletCount} 顆，剩餘金幣：${this.coins}`);
            
            // 💡 播放購買音效
            this.playSound(this.buySound, 0.8);
            
            // 立即更新 UI 顯示 (金幣數與彈珠數)
            this.updateGameUI();
        } else {
            console.log("🚫 金幣不足！需要 3 金幣才能購買一顆彈珠。");
        }
    }

    // 💡 播放一次性音效的公用方法 (可被 Block 等其他腳本呼叫)
    public playSound(clip: AudioClip, volume: number = 1.0) {
        if (clip && this.localAudioSource) {
            this.localAudioSource.playOneShot(clip, volume);
        }
    }

    // 💡 強制一鍵回收所有彈珠並直接跳入下一回合 (終極防卡死重置)
    public onRecallAllBallsBtnClick() {
        console.log("⚠️ 玩家手動觸發【強制重置】直接進入下一回合...");

        // 1. 找出當前畫面中所有彈珠節點並直接強行銷毀，防止畫面上殘留浮空的球
        let childBalls = this.node.children.filter(c => c.name.toLowerCase().startsWith("ball"));
        childBalls.forEach(ballNode => {
            if (ballNode && ballNode.isValid) {
                ballNode.destroy();
            }
        });

        // 2. 暴力重置所有的關鍵狀態旗標，徹底解開可能發生的卡死
        this.isShooting = false;
        this.isAiming = false;
        this.isAimCancel = false;
        this.activeBullets = 0;

        // 3. 清除殘留的瞄準線
        if (this.aimGraphics) {
            this.aimGraphics.clear();
        }

        // 4. 強制跳入下一回合 (方塊下移、生成新方塊、刷新 UI)
        this.nextRound();
    }
}


