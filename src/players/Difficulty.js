
/**
 * Shared Intent Arena: Bot Difficulty Configurations
 */
const DIFFICULTY_CONFIG = {
    Easy: {
        depth: 3,
        randomness: 0.25, // 25% chance of suboptimal move
        timeCap: 150      // ms
    },
    Medium: {
        depth: 4,
        randomness: 0.12, // 12% chance of suboptimal move
        timeCap: 200      // ms
    },
    Hard: {
        depth: 5,
        randomness: 0.04, // 4% chance of suboptimal move
        timeCap: 300      // ms
    },
    Expert: {
        depth: 6,
        randomness: 0,    // 0% chance of suboptimal move
        timeCap: 400,     // ms
        iterativeDeepening: true
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DIFFICULTY_CONFIG;
} else {
    window.DifficultyConfig = DIFFICULTY_CONFIG;
}
