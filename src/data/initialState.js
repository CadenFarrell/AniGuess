export const emptyProfile = {
  id: '',
  name: '',
  animeList: []
};

export const emptySession = {
  players: [],
  currentRound: 1,
  currentPlayerIndex: 0,
  assignments: [],
  scores: [],
  settings: {
    timerEnabled: false,
    timerSeconds: 60,
    pointsPerPosition: [3, 2, 1, 0]
  },
  status: 'setup'
};