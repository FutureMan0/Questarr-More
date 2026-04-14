import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Config, type Game } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type GameStatus } from "./StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import GameGrid from "./GameGrid";
import { getPrimaryConsoleLabel } from "@/lib/game-card-presenter";

interface GlobalSearchResultsProps {
  query: string;
}

function normalizeTitle(title: string | null | undefined): string {
  return (title || "").trim().toLowerCase();
}

function toDedupeKey(game: Game): string {
  if (typeof game.igdbId === "number") {
    return `igdb:${game.igdbId}`;
  }
  const platformKey = (game.platforms?.[0] || "unknown").toLowerCase();
  const releaseKey = game.releaseDate || "unknown";
  return `title:${normalizeTitle(game.title)}:${platformKey}:${releaseKey}`;
}

export default function GlobalSearchResults({ query }: GlobalSearchResultsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const trimmedQuery = query.trim();
  const [providerState, setProviderState] = useState({
    library: true,
    igdb: true,
    screenscraper: true,
  });
  const [mediaPreference, setMediaPreference] = useState<"box-2d" | "box-3d" | "cartridge" | "screenshot">(
    "box-2d"
  );
  const liveSearchQueryOptions = {
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  };

  const { data: config } = useQuery<Config>({
    queryKey: ["/api/config"],
    ...liveSearchQueryOptions,
  });

  const {
    data: libraryGames = [],
    isLoading: isLoadingLibrary,
    isError: isLibraryError,
    refetch: refetchLibrary,
  } = useQuery<Game[]>({
    queryKey: ["/api/games", "global-search-library", trimmedQuery],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/games?search=${encodeURIComponent(trimmedQuery)}`);
      return response.json();
    },
    enabled: trimmedQuery.length > 0,
    ...liveSearchQueryOptions,
  });

  const shouldFetchIgdb = providerState.igdb && trimmedQuery.length > 0;

  const { data: igdbGames = [], isFetching: isFetchingIgdb, refetch: refetchIgdb } = useQuery<Game[]>({
    queryKey: ["/api/igdb/search", "global-search-igdb", trimmedQuery],
    queryFn: async () => {
      try {
        const response = await apiRequest(
          "GET",
          `/api/igdb/search?q=${encodeURIComponent(trimmedQuery)}&limit=80`
        );
        return response.json();
      } catch {
        // Keep search usable even when IGDB is unavailable/misconfigured.
        return [];
      }
    },
    enabled: shouldFetchIgdb,
    ...liveSearchQueryOptions,
  });
  const shouldFetchScreenScraper =
    providerState.screenscraper &&
    trimmedQuery.length > 0 &&
    !!config?.metadataProviders?.screenscraper?.configured;
  const {
    data: screenScraperGames = [],
    isFetching: isFetchingScreenScraper,
    refetch: refetchScreenScraper,
  } = useQuery<Game[]>({
    queryKey: ["/api/metadata/screenscraper/search", "global-search-screenscraper", trimmedQuery, mediaPreference],
    queryFn: async () => {
      try {
        const response = await apiRequest(
          "GET",
          `/api/metadata/screenscraper/search?q=${encodeURIComponent(trimmedQuery)}&limit=80&media=${mediaPreference}`
        );
        return response.json();
      } catch {
        return [];
      }
    },
    enabled: shouldFetchScreenScraper,
    ...liveSearchQueryOptions,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ gameId, status }: { gameId: string; status: GameStatus }) => {
      const response = await apiRequest("PATCH", `/api/games/${gameId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/sections"] });
    },
    onError: () => {
      toast({ description: "Could not update game status.", variant: "destructive" });
    },
  });

  const hiddenMutation = useMutation({
    mutationFn: async ({ gameId, hidden }: { gameId: string; hidden: boolean }) => {
      const response = await apiRequest("PATCH", `/api/games/${gameId}/hidden`, { hidden });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/sections"] });
    },
    onError: () => {
      toast({ description: "Could not update visibility.", variant: "destructive" });
    },
  });

  const games = useMemo(() => {
    const merged = new Map<string, Game>();
    const localByIgdb = new Map<number, Game>();
    const localByTitle = new Map<string, Game>();

    libraryGames.forEach((game) => {
      if (typeof game.igdbId === "number") {
        localByIgdb.set(game.igdbId, game);
      }
      localByTitle.set(normalizeTitle(game.title), game);
      if (providerState.library) {
        merged.set(toDedupeKey(game), game);
      }
    });

    igdbGames.forEach((igdbGame) => {
      const localMatch =
        (typeof igdbGame.igdbId === "number" ? localByIgdb.get(igdbGame.igdbId) : undefined) ||
        localByTitle.get(normalizeTitle(igdbGame.title));

      const mergedGame = localMatch
        ? {
            ...igdbGame,
            ...localMatch,
            id: localMatch.id,
            status: localMatch.status,
            hidden: localMatch.hidden,
          }
        : igdbGame;

      const key = toDedupeKey(mergedGame);
      if (!merged.has(key)) {
        merged.set(key, mergedGame);
      }
    });

    screenScraperGames.forEach((retroGame) => {
      const localMatch =
        (typeof retroGame.igdbId === "number" ? localByIgdb.get(retroGame.igdbId) : undefined) ||
        localByTitle.get(normalizeTitle(retroGame.title));

      const mergedGame = localMatch
        ? {
            ...retroGame,
            ...localMatch,
            id: localMatch.id,
            status: localMatch.status,
            hidden: localMatch.hidden,
          }
        : retroGame;

      const key = toDedupeKey(mergedGame);
      if (!merged.has(key)) {
        merged.set(key, mergedGame);
      }
    });

    return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [libraryGames, igdbGames, screenScraperGames, providerState.library]);

  const groupedByConsole = useMemo(() => {
    const prioritizedKeys = new Set<string>();
    games.forEach((game) => {
      const status = (game.status || "").toLowerCase();
      if (status === "wanted" || status === "pending" || status === "requested") {
        prioritizedKeys.add(toDedupeKey(game));
        return;
      }
      if (status === "owned" || status === "completed" || status === "downloading") {
        prioritizedKeys.add(toDedupeKey(game));
      }
    });

    const grouped = new Map<string, Game[]>();

    games.forEach((game) => {
      if (prioritizedKeys.has(toDedupeKey(game))) return;
      const consoleLabel = getPrimaryConsoleLabel(game);
      const items = grouped.get(consoleLabel) || [];
      items.push(game);
      grouped.set(consoleLabel, items);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([consoleLabel, consoleGames]) => ({
        consoleLabel,
        games: consoleGames.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [games]);

  const wishlistMatches = useMemo(
    () =>
      games
        .filter((game) => {
          const status = (game.status || "").toLowerCase();
          return status === "wanted" || status === "pending" || status === "requested";
        })
        .sort((a, b) => a.title.localeCompare(b.title)),
    [games]
  );

  const libraryMatches = useMemo(
    () =>
      games
        .filter((game) => {
          const status = (game.status || "").toLowerCase();
          return status === "owned" || status === "completed" || status === "downloading";
        })
        .sort((a, b) => a.title.localeCompare(b.title)),
    [games]
  );

  const isLoading = isLoadingLibrary && trimmedQuery.length > 0;
  const isFetching = isLoadingLibrary || isFetchingIgdb || isFetchingScreenScraper;
  const showSearchingState =
    trimmedQuery.length > 0 &&
    games.length === 0 &&
    (isLoading || isFetching || (shouldFetchIgdb && isFetchingIgdb) || isFetchingScreenScraper);

  return (
    <div className="h-full overflow-auto p-6 md:p-8">
      <div className="mx-auto max-w-[1700px] space-y-8">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold">Search Results</h2>
              <Badge variant="outline">{games.length} Games</Badge>
              <Badge variant="secondary">{libraryGames.length} Library</Badge>
              <Badge variant="secondary">{igdbGames.length} IGDB</Badge>
              <Badge variant="secondary">{screenScraperGames.length} ScreenScraper</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void refetchLibrary();
                  if (shouldFetchIgdb) void refetchIgdb();
                  if (shouldFetchScreenScraper) void refetchScreenScraper();
                }}
              >
                Refresh
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Showing results for <span className="font-medium text-foreground">"{query}"</span>.
              Wishlist and Library are shown first, then collapsible console groups.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={providerState.library ? "default" : "outline"}
                onClick={() =>
                  setProviderState((prev) => ({
                    ...prev,
                    library: !prev.library,
                  }))
                }
              >
                Library
              </Button>
              <Button
                size="sm"
                variant={providerState.igdb ? "default" : "outline"}
                onClick={() =>
                  setProviderState((prev) => ({
                    ...prev,
                    igdb: !prev.igdb,
                  }))
                }
              >
                IGDB
              </Button>
              <Button
                size="sm"
                variant={providerState.screenscraper ? "default" : "outline"}
                disabled={!config?.metadataProviders?.screenscraper?.configured}
                onClick={() =>
                  setProviderState((prev) => ({
                    ...prev,
                    screenscraper: !prev.screenscraper,
                  }))
                }
              >
                ScreenScraper
              </Button>
              <Select
                value={mediaPreference}
                onValueChange={(value: "box-2d" | "box-3d" | "cartridge" | "screenshot") =>
                  setMediaPreference(value)
                }
              >
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="Artwork preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="box-2d">2D Box Art</SelectItem>
                  <SelectItem value="box-3d">3D Box Art</SelectItem>
                  <SelectItem value="cartridge">Cartridge/CD Art</SelectItem>
                  <SelectItem value="screenshot">Screenshot First</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!config?.metadataProviders?.screenscraper?.configured && (
              <p className="text-xs text-muted-foreground">
                ScreenScraper disabled: configure credentials in Settings - Services.
              </p>
            )}
          </CardContent>
        </Card>

        {showSearchingState ? (
          <Card>
            <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
              <p>Searching games...</p>
              <p>Results are still loading from the selected providers.</p>
            </CardContent>
          </Card>
        ) : isLibraryError ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>Search data is temporarily unavailable. Please refresh results.</p>
              <Button size="sm" variant="outline" onClick={() => void refetchLibrary()}>
                Retry Library Search
              </Button>
            </CardContent>
          </Card>
        ) : groupedByConsole.length === 0 && wishlistMatches.length === 0 && libraryMatches.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
              <p>No games found for this search.</p>
              <p>No matches in your Library or in IGDB.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {wishlistMatches.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">Wishlist</h3>
                  <Badge variant="secondary">{wishlistMatches.length}</Badge>
                </div>
                <GameGrid
                  games={wishlistMatches}
                  onStatusChange={(gameId, status) => statusMutation.mutate({ gameId, status })}
                  onToggleHidden={(gameId, hidden) => hiddenMutation.mutate({ gameId, hidden })}
                  isLoading={isLoading}
                  isFetching={isFetching}
                />
              </section>
            )}

            {libraryMatches.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">Library</h3>
                  <Badge variant="secondary">{libraryMatches.length}</Badge>
                </div>
                <GameGrid
                  games={libraryMatches}
                  onStatusChange={(gameId, status) => statusMutation.mutate({ gameId, status })}
                  onToggleHidden={(gameId, hidden) => hiddenMutation.mutate({ gameId, hidden })}
                  isLoading={isLoading}
                  isFetching={isFetching}
                />
              </section>
            )}

            {groupedByConsole.length > 0 && (
              <Accordion
                key={trimmedQuery}
                type="multiple"
                className="rounded-xl border border-white/10 bg-slate-950/30 px-4"
              >
                {groupedByConsole.map((group) => (
                  <AccordionItem key={group.consoleLabel} value={`console-${group.consoleLabel}`}>
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold">{group.consoleLabel}</span>
                        <Badge variant="secondary">{group.games.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <GameGrid
                        games={group.games}
                        onStatusChange={(gameId, status) => statusMutation.mutate({ gameId, status })}
                        onToggleHidden={(gameId, hidden) => hiddenMutation.mutate({ gameId, hidden })}
                        isLoading={isLoading}
                        isFetching={isFetching}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </>
        )}
      </div>
    </div>
  );
}
