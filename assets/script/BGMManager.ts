import { _decorator, Component, Node, director, AudioSource, AudioClip, input, Input } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BGMManager')
export class BGMManager extends Component {

    public static instance: BGMManager = null!;

    @property(AudioClip)
    bgmClip: AudioClip = null!; // 👈 拖曳綁定循環背景音樂檔案

    @property
    bgmVolume: number = 0.3; // 👈 預設背景音樂音量大小 (0.0 ~ 1.0，建議設為 0.3 較為柔和)

    private audioSource: AudioSource = null!;

    onLoad() {
        // 💡 單例防護：如果已經有 BGM 播放器在運行，直接銷毀當前新產生的，避免切換場景重疊播放
        if (BGMManager.instance && BGMManager.instance !== this) {
            this.node.destroy();
            return;
        }

        BGMManager.instance = this;

        // 💡 關鍵核心：將此節點設置為 Cocos 常駐節點 (切換場景不銷毀，BGM 不間斷)
        director.addPersistRootNode(this.node);

        // 取得或動態創建 AudioSource 播放元件
        this.audioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        
        if (this.bgmClip) {
            this.audioSource.clip = this.bgmClip;
            this.audioSource.loop = true; // 開啟循環播放
            this.audioSource.volume = this.bgmVolume; // 💡 設定音量大小
            this.audioSource.playOnAwake = false;
        }

        // 💡 解決瀏覽器 Autoplay 限制：監聽全域點擊，只要玩家在畫面上點擊任何地方，就嘗試解鎖並播放音樂
        input.on(Input.EventType.TOUCH_START, this.tryPlayBGMOnFirstTouch, this);
    }

    start() {
        this.playBGM();
    }

    onDestroy() {
        // 註銷事件監聽，防止記憶體洩漏
        input.off(Input.EventType.TOUCH_START, this.tryPlayBGMOnFirstTouch, this);
    }

    // 💡 玩家首次觸控畫面時，觸發背景音樂解鎖播放
    private tryPlayBGMOnFirstTouch() {
        this.playBGM();
        // 💡 如果已經成功播放，就取消此事件監聽，減少效能開銷
        if (this.audioSource && this.audioSource.playing) {
            input.off(Input.EventType.TOUCH_START, this.tryPlayBGMOnFirstTouch, this);
        }
    }

    // 💡 播放背景音樂
    public playBGM() {
        if (this.audioSource && this.bgmClip && !this.audioSource.playing) {
            this.audioSource.play();
            console.log("🎵 背景音樂已成功解鎖並循環播放中...");
        }
    }

    // 💡 停止背景音樂
    public stopBGM() {
        if (this.audioSource && this.audioSource.playing) {
            this.audioSource.stop();
            console.log("🎵 背景音樂已停止。");
        }
    }
}
