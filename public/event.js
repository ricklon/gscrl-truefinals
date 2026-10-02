// Shared selection keeps stable OBS URLs working across event transitions.
window.selectTournament = function (tournaments) {
  const requested = new URLSearchParams(location.search).get('tournament')?.toLowerCase();
  if (requested) {
    return tournaments.find(t => t.tournamentId === requested
      || t.division?.key === requested || t.division?.aliases?.includes(requested));
  }
  return tournaments.find(t => t.nowFighting.length)
    || tournaments.find(t => t.upNext.length)
    || tournaments.filter(t => t.result.length)
      .sort((a, b) => (b.result[0].endTime || 0) - (a.result[0].endTime || 0))[0]
    || tournaments[0];
};
