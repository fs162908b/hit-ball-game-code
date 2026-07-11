import { _decorator, Component, Node, director, AudioSource, AudioClip } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('menuScene')
export class menuScene extends Component {

    @property(AudioClip)
    clickSound: AudioClip = null!; // 👈 拖曳綁定開始按鈕點擊音效

    private localAudioSource: AudioSource = null!; // 👈 播放音效組件

    private isClicking: boolean = false; // 👈 防止重連連擊旗標

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
        if (this.isClicking) return; // 👈 如果已經在跳轉中，直接忽略重複點擊
        this.isClicking = true;

        console.log("👉 點擊開始遊戲，載入 GameScene...");
        
        // 💡 播放按鈕點擊音效
        if (this.clickSound && this.localAudioSource) {
            this.localAudioSource.playOneShot(this.clickSound, 1.0);
        }

        // 💡 去除人工延遲，立即異步載入場景 (Cocos 載入資源時音效會在背景繼續播放，反應最即時)
        director.loadScene('GameScene', (err) => {
            if (err) {
                console.error('場景載入失敗:', err);
                this.isClicking = false; // 載入失敗時重設，允許重新點選
            } else {
                console.log('成功進入遊戲場景');
            }
        });
    }
}


