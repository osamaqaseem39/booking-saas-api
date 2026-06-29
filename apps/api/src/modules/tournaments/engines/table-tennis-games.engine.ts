export type TableTennisGameScore = { home: number; away: number };

export function tableTennisGameWinner(
  game: TableTennisGameScore,
): 'home' | 'away' | null {
  const { home, away } = game;
  if (home === away) return null;
  const w = Math.max(home, away);
  const l = Math.min(home, away);
  if (w < 11) return null;
  if (w - l >= 2) return home > away ? 'home' : 'away';
  return null;
}

export function countTableTennisGamesWon(games: TableTennisGameScore[]): {
  home: number;
  away: number;
} {
  let home = 0;
  let away = 0;
  for (const g of games) {
    const w = tableTennisGameWinner(g);
    if (w === 'home') home += 1;
    if (w === 'away') away += 1;
  }
  return { home, away };
}

export function tableTennisGamesToWin(bestOfGames: 5 | 7 = 5): number {
  return Math.ceil(bestOfGames / 2);
}

export function resolveTableTennisGamesToWin(
  blueprint?: { scoring?: { tableTennisBestOfGames?: 5 | 7 } } | null,
): number {
  const bestOf = blueprint?.scoring?.tableTennisBestOfGames === 7 ? 7 : 5;
  return tableTennisGamesToWin(bestOf);
}

export function validateTableTennisMatchScore(
  games: TableTennisGameScore[],
  gamesToWin = 3,
): {
  games: TableTennisGameScore[];
  homeGames: number;
  awayGames: number;
} {
  const active = games.filter((g) => g.home > 0 || g.away > 0);
  if (active.length === 0) {
    throw new Error('Enter at least one completed game');
  }
  for (const g of active) {
    if (!tableTennisGameWinner(g)) {
      throw new Error(`Game ${g.home}-${g.away} is not a valid completed game`);
    }
  }
  const { home, away } = countTableTennisGamesWon(active);
  if (home === away) {
    throw new Error('Match cannot end in a draw');
  }
  if (Math.max(home, away) !== gamesToWin) {
    throw new Error(`Winning side must win ${gamesToWin} games`);
  }
  const totalGames = home + away;
  const maxGames = gamesToWin * 2 - 1;
  if (totalGames < gamesToWin || totalGames > maxGames) {
    throw new Error('Invalid game count for match result');
  }
  if (active.length !== totalGames) {
    throw new Error(`Match needs exactly ${totalGames} completed games`);
  }
  return { games: active, homeGames: home, awayGames: away };
}
