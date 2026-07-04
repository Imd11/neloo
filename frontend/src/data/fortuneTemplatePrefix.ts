/**
 * Hidden fortune prompt prefixes.
 *
 * These prefixes are prepended to the user's birth information before model
 * submission. They must not be shown in visible chat history.
 */

export const FORTUNE_TEMPLATE_PREFIX: Record<number, string> = {
    1: `Analysis direction: Full BaZi reading.
Provide a comprehensive BaZi analysis for the user, including:
- Four pillars and heavenly stems / earthly branches
- Chart structure and strength assessment
- Five-element balance, useful element, and favorable / unfavorable elements
- Ten-god configuration and its influence
- Major luck cycle overview

User information:
`,

    2: `Analysis direction: Annual luck.
Focus on the user's annual and near-term luck, including:
- Overall flow for 2026, the Bing-Wu year
- Monthly changes and key months
- The next three years of direction
- Interaction between major luck cycles and annual luck
- Periods that require caution

User information:
`,

    3: `Analysis direction: Relationship and romance.
Focus on the user's relationship and marriage tendencies, including:
- Romance indicators and peach-blossom signs
- Likely timing for meaningful relationships
- Potential partner traits, direction, and career tendency
- Marriage palace condition
- Relationship risks or patterns to watch

User information:
`,

    4: `Analysis direction: Career.
Focus on the user's career development, including:
- Suitable industries based on five-element balance
- Official-star and resource-star configuration
- Career peak periods and lower periods
- Employment vs entrepreneurship tendencies
- Workplace risks and practical cautions

User information:
`,

    5: `Analysis direction: Wealth.
Focus on the user's wealth profile, including:
- Regular income tendencies
- Windfall, investment, and speculative money tendencies
- Wealth storage and retention ability
- Favorable years and directions for money opportunities
- Money-loss risks and practical cautions

User information:
`,

    6: `Analysis direction: Health.
Focus on the user's health tendencies, including:
- Possible weak areas based on five-element imbalance
- Types of health issues that deserve attention
- Years or periods that require extra care
- Suitable wellness directions for exercise and diet
- Supportive directions and colors

User information:
`,

    7: `Analysis direction: Personality and talent.
Focus on the user's personality and natural strengths, including:
- Personality traits from day master and ten-god configuration
- Natural strengths and potential abilities
- Strengths and areas that may need adjustment
- Suitable growth direction
- Interpersonal style and recurring patterns

User information:
`,

    8: `Analysis direction: Family.
Focus on the user's family relationships, including:
- Affinity with parents, siblings, and close relatives
- Child-related luck and family continuity
- Relationship with parents
- Household harmony
- Family patterns and cautions

User information:
`,
};

export function getFortuneTemplatePrefix(templateId: number): string {
    return FORTUNE_TEMPLATE_PREFIX[templateId] || "";
}
