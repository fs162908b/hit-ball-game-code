import { _decorator, Component, Node, director, AudioSource, AudioClip } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('menuScene')
export class menuScene extends Component {

    @property(AudioClip)
    clickSound: AudioClip = null!; // 👈 拖曳綁定開始按鈕點擊音效

    private localAudioSource: AudioSource = null!; // 👈 播放音效組件

    onLoad() {
        // 💡 取得或動態掛載 AudioSource 元件
        this.localAudioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
    }

    start() {

    }

    update(deltaTime: number) {
        
    }

    // 點擊開始按鈕時觸發的方法
    onStartGameBtnClick() {
        console.log("👉 點擊開始遊戲，播放音效後載入 GameScene...");
        
        // 💡 播放按鈕點擊音效
        if (this.clickSound && this.localAudioSource) {
            this.localAudioSource.playOneShot(this.clickSound, 1.0);
        }

        // 💡 稍微延遲 0.15 秒跳轉，確保音效能被玩家聽到
        setTimeout(() => {
            director.loadScene('GameScene', (err) => {
                if (err) {
                    console.error('場景載入失敗:', err);
                } else {
                    console.log('成功進入遊戲場景');
                }
            });
        }, 150);
    }
}


