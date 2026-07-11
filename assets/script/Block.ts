import { _decorator, Component, Label, Collider2D, Contact2DType, PhysicsSystem2D, tween, Vec3, Sprite, Color } from 'cc';
import { GameArea } from './GameArea'; // 👈 導入 GameArea 以使用單例加錢
const { ccclass, property } = _decorator;

@ccclass('Block')
export class Block extends Component {

    @property(Label)
    hpLabel: Label = null!; // 用來顯示血量的 Label

    public row: number = 0; // 👈 記錄網格中的行數 (Y)
    public col: number = 0; // 👈 記錄網格中的列數 (X)

    private hp: number = 10; // 方塊當前的生命值
    
    private isFlashingDanger: boolean = false; // 👈 記錄目前是否在閃爍危險警告
    private flashTween: any = null; // 👈 儲存閃爍動畫實例

    onLoad() {
        // 💡 強制啟用 2D 物理系統
        PhysicsSystem2D.instance.enable = true;

        // 💡 程式碼強制啟用碰撞監聽
        let collider = this.getComponent(Collider2D);
        if (collider) {
            (collider as any).enabledContactListener = true; 
        }

        // 💡 註冊全域 2D 物理碰撞監聽事件
        PhysicsSystem2D.instance.on(Contact2DType.BEGIN_CONTACT, this.onGlobalBeginContact, this);
    }

    start() {
        this.updateUI();
    }

    onDestroy() {
        // 💡 銷毀時停止動畫，避免殘留
        if (this.flashTween) {
            this.flashTween.stop();
            this.flashTween = null;
        }

        // 💡 當方塊被銷毀時，務必取消全域事件監聽，防止記憶體洩漏
        if (PhysicsSystem2D.instance) {
            PhysicsSystem2D.instance.off(Contact2DType.BEGIN_CONTACT, this.onGlobalBeginContact, this);
        }
    }

    // 💡 依據當前的 row 和 col，更新方塊在畫面上的位置
    public updatePosition(smooth: boolean = true) {
        // 寬 600, X 軸座標公式
        let targetX = -250 + this.col * 100;
        // 高 1000, Y 軸座標公式
        let targetY = 450 - this.row * 100;

        if (smooth) {
            // 平滑移動到目標位置
            tween(this.node)
                .to(0.2, { position: new Vec3(targetX, targetY, 0) }, { easing: 'quadOut' })
                .start();
        } else {
            // 直接跳轉
            this.node.setPosition(targetX, targetY);
        }

        // 💡 每次更新位置，檢測是否需要啟動紅色閃爍警告
        this.checkDanger();
    }

    // 💡 檢測是否只差一回合就觸底 (row === 7)，並進行紅色閃爍
    private checkDanger() {
        let sprite = this.getComponent(Sprite);
        if (!sprite) return;

        if (this.row === 7) {
            // 只差一回合就 Game Over，啟動紅色閃爍
            if (!this.isFlashingDanger) {
                this.isFlashingDanger = true;
                
                // 停止現有動畫
                if (this.flashTween) this.flashTween.stop();

                // 讓方塊顏色在「紅色」和「白色(原色)」之間循環漸變
                this.flashTween = tween(sprite)
                    .to(0.3, { color: new Color(255, 80, 80, 255) })
                    .to(0.3, { color: new Color(255, 255, 255, 255) })
                    .union()
                    .repeatForever()
                    .start();
            }
        } else {
            // 遠離危險區，恢復原本的顏色
            if (this.isFlashingDanger) {
                this.isFlashingDanger = false;
                if (this.flashTween) {
                    this.flashTween.stop();
                    this.flashTween = null;
                }
                sprite.color = new Color(255, 255, 255, 255); // 恢復白色
            }
        }
    }

    // 全域物理碰撞回呼
    private onGlobalBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: any) {
        let myCollider = this.getComponent(Collider2D);
        if (myCollider) {
            // 判斷碰撞的兩者中，是否包含這顆方塊自己
            if (selfCollider === myCollider || otherCollider === myCollider) {
                // 找出對方是誰
                let other = selfCollider === myCollider ? otherCollider : selfCollider;
                this.onHit(other);
            }
        }
    }

    // 實際的撞擊邏輯
    private onHit(otherCollider: Collider2D) {
        console.log("💥 方塊碰撞事件觸發！被此節點撞擊：", otherCollider.node.name);

        // 💡 累加彈珠撞擊方塊的總次數 (得分)
        if (GameArea.instance) {
            GameArea.instance.addHitCount();
            GameArea.instance.playSound(GameArea.instance.hitSound, 0.45); // 👈 播放方塊碰撞音效
        }

        // 只要被撞到，HP 就扣 1
        this.hp -= 1;
        this.updateUI();

        // 如果血量歸零，銷毀方塊
        if (this.hp <= 0) {
            this.handleDestruction();
        }
    }

    // 初始化方塊血量（由 GameManager 動態產生時呼叫）
    public init(maxHp: number) {
        this.hp = maxHp;
        this.updateUI();
    }

    // 更新生命值文字
    private updateUI() {
        if (this.hpLabel) {
            this.hpLabel.string = this.hp.toString();
        }
    }

    // 銷毀方塊時的處理
    private handleDestruction() {
        // 💡 呼叫 GameArea 單例，為玩家增加金錢
        if (GameArea.instance) {
            GameArea.instance.addCoins(1);
        }

        // 💡 ⚠️ 關鍵修正：在 2D 物理碰撞回呼執行期間，物理世界處於「鎖定狀態」
        setTimeout(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy(); // 銷毀方塊節點
            }
        }, 0);
    }
}
