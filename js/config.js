
const CONFIG = {
    // Feature Flags
    FLAGS: {
        FRIEND_PLAY: true,
        MATCHMAKING: true,
        AI_MODE: true,
        RANKED: false
    },

    // Game Constants
    ROOM_CODE_LENGTH: 6,
    VERSION: '0.6.0-playtest'
};

if (typeof module !== 'undefined') {
    module.exports = CONFIG;
} else {
    window.GameConfig = CONFIG;
}
