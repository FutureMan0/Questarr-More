import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, Settings2, AlertCircle } from "lucide-react";
import GameCarouselSection from "@/components/GameCarouselSection";
import { type Game, type Config } from "@shared/schema";
import { type GameStatus } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { mapGameToInsertGame } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import DiscoverSettingsModal from "@/components/DiscoverSettingsModal";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RssFeedList from "@/components/RssFeedList";
import RssSettings from "@/components/RssSettings";
import { Rss } from "lucide-react";
import GameGrid from "@/components/GameGrid";

interface Genre {
  id: number;
  name: string;
}

interface Platform {
  id: number;
  name: string;
}

interface DiscoverStudio {
  id: string;
  name: string;
  coverUrl: string;
  gameCount: number;
}

interface DiscoverCollection {
  id: string;
  name: string;
  coverUrl: string;
  gameCount: number;
}

// Default genres used as fallback when API fails or returns empty
// These are common game genres that provide a good starting point
const DEFAULT_GENRES: Genre[] = [
  { id: 1, name: "Action" },
  { id: 2, name: "Adventure" },
  { id: 3, name: "RPG" },
  { id: 4, name: "Strategy" },
  { id: 5, name: "Shooter" },
  { id: 6, name: "Puzzle" },
  { id: 7, name: "Racing" },
  { id: 8, name: "Sports" },
  { id: 9, name: "Simulation" },
  { id: 10, name: "Fighting" },
];

// Default platforms used as fallback when API fails or returns empty
// These represent the major gaming platforms
const DEFAULT_PLATFORMS: Platform[] = [
  { id: 1, name: "PC" },
  { id: 2, name: "PlayStation" },
  { id: 3, name: "Xbox" },
  { id: 4, name: "Nintendo" },
];

// Cache duration for relatively static data (1 hour)
const STATIC_DATA_STALE_TIME = 1000 * 60 * 60;
const PLATFORM_PAGE_SIZE = 24;

// 🎨 Palette: Custom SelectTrigger that shows a loading spinner.
const SelectTriggerWithSpinner = ({
  loading,
  children,
  ...props
}: React.ComponentProps<typeof SelectTrigger> & { loading: boolean }) => {
  return (
    <SelectTrigger {...props}>
      {children}
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    </SelectTrigger>
  );
};

export default function DiscoverPage() {
  const [selectedGenre, setSelectedGenre] = useState<string>("Adventure");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("PC");
  const [selectedStudio, setSelectedStudio] = useState<string>("");
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [hideOwned, setHideOwned] = useState<boolean>(() => {
    return localStorage.getItem("discoverHideOwned") === "true";
  });
  const [hideWanted, setHideWanted] = useState<boolean>(() => {
    return localStorage.getItem("discoverHideWanted") === "true";
  });

  // ⚡ Bolt: Using the useDebounce hook to limit the frequency of API calls
  const debouncedGenre = useDebounce(selectedGenre, 300);
  const debouncedPlatform = useDebounce(selectedPlatform, 300);
  const platformSentinelRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config } = useQuery<Config>({
    queryKey: ["/api/config"],
  });

  useEffect(() => {
    localStorage.setItem("discoverHideOwned", hideOwned.toString());
  }, [hideOwned]);

  useEffect(() => {
    localStorage.setItem("discoverHideWanted", hideWanted.toString());
  }, [hideWanted]);

  // Fetch local games to filter hidden ones
  const { data: localGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/games?includeHidden=true"], // We need all games to know which are hidden
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/games?includeHidden=true");
      return response.json();
    },
    enabled: !!config?.igdb.configured,
  });

  const hiddenIgdbIds = useMemo(() => {
    return new Set(localGames.filter((g) => g.hidden).map((g) => g.igdbId));
  }, [localGames]);

  const ownedIgdbIds = useMemo(() => {
    return new Set(
      localGames
        .filter(
          (g) => g.status === "owned" || g.status === "completed" || g.status === "downloading"
        )
        .map((g) => g.igdbId)
    );
  }, [localGames]);

  const wantedIgdbIds = useMemo(() => {
    return new Set(
      localGames.filter((g) => g.status === "wanted" && !g.hidden).map((g) => g.igdbId)
    );
  }, [localGames]);

  const igdbToLocalIdMap = useMemo(() => {
    const map = new Map<number, string>();
    localGames.forEach((g) => {
      if (g.igdbId) map.set(g.igdbId, g.id);
    });
    return map;
  }, [localGames]);

  const igdbToLocalGameMap = useMemo(() => {
    const map = new Map<number, Game>();
    localGames.forEach((g) => {
      if (g.igdbId) map.set(g.igdbId, g);
    });
    return map;
  }, [localGames]);

  const filterGames = useCallback(
    (games: Game[]) => {
      return games
        .filter((g: Game) => {
          if (typeof g.igdbId === "number" && hiddenIgdbIds.has(g.igdbId)) return false;

          if (hideOwned && typeof g.igdbId === "number" && ownedIgdbIds.has(g.igdbId)) return false;

          if (hideWanted && typeof g.igdbId === "number" && wantedIgdbIds.has(g.igdbId)) {
            return false;
          }

          return true;
        })
        .map((g: Game) => {
          if (typeof g.igdbId !== "number") return g;
          const localMatch = igdbToLocalGameMap.get(g.igdbId);
          if (!localMatch) return g;

          // Merge local status/identity so card badges and actions reflect real collection state.
          return {
            ...g,
            id: localMatch.id,
            status: localMatch.status,
            hidden: localMatch.hidden,
          };
        });
    },

    [hiddenIgdbIds, ownedIgdbIds, wantedIgdbIds, hideOwned, hideWanted, igdbToLocalGameMap]
  );

  // Fetch available genres with caching and error handling

  const {
    data: genres = [],

    isError: genresError,

    isFetching: isFetchingGenres,
  } = useQuery<Genre[]>({
    queryKey: ["/api/igdb/genres"],

    queryFn: async () => {
      const response = await apiRequest("GET", "/api/igdb/genres");

      return response.json();
    },

    staleTime: STATIC_DATA_STALE_TIME,

    retry: 2,
    enabled: !!config?.igdb.configured,
  });

  // Fetch available platforms with caching and error handling

  const {
    data: platforms = [],

    isError: platformsError,

    isFetching: isFetchingPlatforms,
  } = useQuery<Platform[]>({
    queryKey: ["/api/igdb/platforms"],

    queryFn: async () => {
      const response = await apiRequest("GET", "/api/igdb/platforms");

      return response.json();
    },

    staleTime: STATIC_DATA_STALE_TIME,

    retry: 2,
    enabled: !!config?.igdb.configured,
  });

  const { data: discoverStudios = [] } = useQuery<DiscoverStudio[]>({
    queryKey: ["/api/igdb/studios"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/igdb/studios?limit=16");
      return response.json();
    },
    staleTime: STATIC_DATA_STALE_TIME,
    enabled: !!config?.igdb.configured,
  });

  const { data: discoverCollections = [] } = useQuery<DiscoverCollection[]>({
    queryKey: ["/api/igdb/collections"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/igdb/collections?limit=16");
      return response.json();
    },
    staleTime: STATIC_DATA_STALE_TIME,
    enabled: !!config?.igdb.configured,
  });

  // Handle errors with toast notifications

  useEffect(() => {
    if (genresError) {
      toast({
        description: "Failed to load genres, using defaults",

        variant: "destructive",
      });
    }
  }, [genresError, toast]);

  useEffect(() => {
    if (platformsError) {
      toast({
        description: "Failed to load platforms, using defaults",

        variant: "destructive",
      });
    }
  }, [platformsError, toast]);

  useEffect(() => {
    if (!selectedStudio && discoverStudios.length > 0) {
      setSelectedStudio(discoverStudios[0].name);
    }
  }, [discoverStudios, selectedStudio]);

  useEffect(() => {
    if (!selectedCollection && discoverCollections.length > 0) {
      setSelectedCollection(discoverCollections[0].name);
    }
  }, [discoverCollections, selectedCollection]);

  // Track game mutation (for Discovery games)

  const trackGameMutation = useMutation({
    mutationFn: async (game: Game) => {
      const gameData = mapGameToInsertGame(game);

      const response = await apiRequest("POST", "/api/games", {
        ...gameData,

        status: "wanted",
      });

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });

      toast({ description: "Game added to watchlist!" });
    },

    onError: (error: Error) => {
      const errorMessage = error.message || String(error);

      if (errorMessage.includes("409") || errorMessage.includes("already in collection")) {
        toast({
          description: "Game is already in your collection",

          variant: "default",
        });
      } else {
        toast({
          description: "Failed to track game",

          variant: "destructive",
        });
      }
    },
  });

  // Hide game mutation

  const hideGameMutation = useMutation({
    mutationFn: async (game: Game) => {
      // Check if game exists locally first (use our map for consistency)

      const localId = game.igdbId ? igdbToLocalIdMap.get(game.igdbId) : undefined;

      if (localId) {
        // Update existing game

        const response = await apiRequest("PATCH", `/api/games/${localId}/hidden`, {
          hidden: true,
        });

        return response.json();
      } else {
        // Add new hidden game

        const gameData = mapGameToInsertGame(game);

        const response = await apiRequest("POST", "/api/games", {
          ...gameData,

          status: "wanted", // Default status, but hidden

          hidden: true,
        });

        return response.json();
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });

      toast({ description: "Game hidden from discovery" });
    },

    onError: () => {
      toast({
        description: "Failed to hide game",

        variant: "destructive",
      });
    },
  });

  // Add game mutation (for status changes on Discovery games)

  const addGameMutation = useMutation({
    mutationFn: async ({
      game,

      status,

      localId,
    }: {
      game: Game;

      status: GameStatus;

      localId?: string;
    }) => {
      if (localId) {
        // Update existing game status

        const response = await apiRequest("PATCH", `/api/games/${localId}/status`, {
          status,
        });

        return response.json();
      } else {
        // Add new game with status

        const gameData = mapGameToInsertGame(game);

        const response = await apiRequest("POST", "/api/games", {
          ...gameData,

          status,
        });

        return response.json();
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });

      toast({ description: "Game added to collection successfully" });
    },

    onError: () => {
      toast({
        description: "Failed to add game to collection",

        variant: "destructive",
      });
    },
  });

  // ⚡ Bolt: Using useCallback to memoize event handlers, preventing unnecessary

  // re-renders in child components like `GameCard` that rely on stable function

  // references for their `React.memo` optimization.

  const handleStatusChange = useCallback(
    (gameId: string, newStatus: GameStatus) => {
      // Find game object in queries

      const findGameInQueries = (): Game | undefined => {
        // Search in all cached query data

        const allQueries = queryClient.getQueriesData<Game[]>({
          predicate: (query) => {
            const key = query.queryKey[0] as string;

            return key.startsWith("/api/igdb/");
          },
        });

        for (const [, data] of allQueries) {
          const game = data?.find((g) => g.id === gameId);

          if (game) return game;
        }

        return undefined;
      };

      const game = findGameInQueries();

      if (game) {
        const localId = game.igdbId ? igdbToLocalIdMap.get(game.igdbId) : undefined;

        addGameMutation.mutate({ game, status: newStatus, localId });
      }
    },

    [queryClient, addGameMutation, igdbToLocalIdMap]
  );

  const handleTrackGame = useCallback(
    (game: Game) => {
      trackGameMutation.mutate(game);
    },

    [trackGameMutation]
  );

  const handleToggleHidden = useCallback(
    (gameId: string, hidden: boolean) => {
      // We only support hiding from discovery page for now via the card button

      // Unhiding is done via settings

      if (hidden) {
        const findGameInQueries = (): Game | undefined => {
          // Search in all cached query data

          const allQueries = queryClient.getQueriesData<Game[]>({
            predicate: (query) => {
              const key = query.queryKey[0] as string;

              return key.startsWith("/api/igdb/");
            },
          });

          for (const [, data] of allQueries) {
            const game = data?.find((g) => g.id === gameId);

            if (game) return game;
          }

          return undefined;
        };

        const game = findGameInQueries();

        if (game) {
          hideGameMutation.mutate(game);
        }
      }
    },

    [queryClient, hideGameMutation]
  );

  // ⚡ Bolt: Memoizing fetch functions with `useCallback` ensures they have stable
  // references across re-renders. This is critical for preventing child components
  // like `GameCarouselSection` from re-rendering unnecessarily when they are
  // wrapped in `React.memo` and receive these functions as props.
  const fetchPopularGames = useCallback(async (): Promise<Game[]> => {
    const response = await apiRequest("GET", "/api/igdb/popular?limit=20");
    const games = await response.json();
    return filterGames(games);
  }, [filterGames]);

  const fetchRecentGames = useCallback(async (): Promise<Game[]> => {
    const response = await apiRequest("GET", "/api/igdb/recent?limit=20");
    const games = await response.json();
    return filterGames(games);
  }, [filterGames]);

  const fetchUpcomingGames = useCallback(async (): Promise<Game[]> => {
    const response = await apiRequest("GET", "/api/igdb/upcoming?limit=20");
    const games = await response.json();
    return filterGames(games);
  }, [filterGames]);

  const fetchGamesByGenre = useCallback(async (): Promise<Game[]> => {
    // Validate selectedGenre against known genres before making API call
    const validGenres: Genre[] = genres.length > 0 ? genres : DEFAULT_GENRES;
    const isValidGenre = validGenres.some((g: Genre) => g.name === debouncedGenre);
    if (!isValidGenre) {
      // This case should ideally not be hit if UI is synced with state
      return []; // Return empty instead of throwing to prevent crash
    }

    const response = await apiRequest(
      "GET",
      `/api/igdb/genre/${encodeURIComponent(debouncedGenre)}?limit=20`
    );
    const games = await response.json();
    return filterGames(games);
  }, [debouncedGenre, genres, filterGames]);

  const fetchGamesByStudio = useCallback(async (): Promise<Game[]> => {
    if (!selectedStudio) return [];
    const response = await apiRequest(
      "GET",
      `/api/igdb/studio/${encodeURIComponent(selectedStudio)}?limit=20`
    );
    const games = await response.json();
    return filterGames(games);
  }, [filterGames, selectedStudio]);

  const fetchGamesByCollection = useCallback(async (): Promise<Game[]> => {
    if (!selectedCollection) return [];
    const response = await apiRequest(
      "GET",
      `/api/igdb/collection/${encodeURIComponent(selectedCollection)}?limit=20`
    );
    const games = await response.json();
    return filterGames(games);
  }, [filterGames, selectedCollection]);

  const {
    data: platformPages,
    isLoading: isLoadingPlatformGames,
    isFetching: isFetchingPlatformGames,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchPlatformGames,
  } = useInfiniteQuery<Game[]>({
    queryKey: [
      "/api/igdb/platform/infinite",
      debouncedPlatform,
      hiddenIgdbIds.size,
      hideOwned,
      hideWanted,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const validPlatforms: Platform[] = platforms.length > 0 ? platforms : DEFAULT_PLATFORMS;
      const isValidPlatform = validPlatforms.some((p: Platform) => p.name === debouncedPlatform);
      if (!isValidPlatform) return [];

      const response = await apiRequest(
        "GET",
        `/api/igdb/platform/${encodeURIComponent(debouncedPlatform)}?limit=${PLATFORM_PAGE_SIZE}&offset=${pageParam}`
      );
      const games = await response.json();
      return filterGames(games);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PLATFORM_PAGE_SIZE) return undefined;
      return allPages.length * PLATFORM_PAGE_SIZE;
    },
    enabled: !!config?.igdb.configured,
  });

  const platformGames = useMemo(
    () => (platformPages?.pages ? platformPages.pages.flatMap((page) => page) : []),
    [platformPages]
  );

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !platformSentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: "220px" }
    );

    observer.observe(platformSentinelRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (config && !config.igdb.configured) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="bg-muted p-4 rounded-full">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">IGDB Configuration Required</h2>
        <p className="text-muted-foreground max-w-md">
          To discover and browse games, you need to configure your IGDB credentials in the settings.
        </p>
        <Link href="/settings">
          <Button>Go to Settings</Button>
        </Link>
      </div>
    );
  }

  const displayGenres: Genre[] = genres.length > 0 ? genres : DEFAULT_GENRES;
  const displayPlatforms: Platform[] = platforms.length > 0 ? platforms : DEFAULT_PLATFORMS;

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto" data-testid="discover-page">
      <div className="p-6 space-y-8 max-w-full">
        <Tabs defaultValue="igdb" className="space-y-6">
          <div className="sticky top-0 z-30 -mx-2 rounded-xl px-2 py-2 backdrop-blur-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="glass-surface w-full rounded-xl px-4 py-3 md:px-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">Discover Games</h1>
                    <p className="text-muted-foreground">
                      Explore popular games, new releases, and find your next adventure
                    </p>
                  </div>

                  <TabsList className="border border-white/10 bg-slate-900/70">
                    <TabsTrigger value="igdb">IGDB Discovery</TabsTrigger>
                    <TabsTrigger value="rss" className="gap-2">
                      <Rss className="h-4 w-4" /> RSS Feeds
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </div>
          </div>

          <TabsContent value="igdb" className="space-y-8">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowSettings(true)}
                aria-label="Discovery settings"
              >
                <Settings2 className="h-4 w-4" />
                Discovery Settings
              </Button>
            </div>

            <DiscoverSettingsModal
              open={showSettings}
              onOpenChange={setShowSettings}
              hiddenGames={localGames.filter((g) => g.hidden)}
              hideOwned={hideOwned}
              onHideOwnedChange={setHideOwned}
              hideWanted={hideWanted}
              onHideWantedChange={setHideWanted}
            />

            {/* Popular Games Section */}
            <GameCarouselSection
              title="Popular Games"
              queryKey={["/api/igdb/popular", hiddenIgdbIds.size, hideOwned, hideWanted]}
              queryFn={fetchPopularGames}
              onStatusChange={handleStatusChange}
              onTrackGame={handleTrackGame}
              onToggleHidden={handleToggleHidden}
              isDiscovery={true}
            />

            {/* Recent Releases Section */}
            <GameCarouselSection
              title="Recent Releases"
              queryKey={["/api/igdb/recent", hiddenIgdbIds.size, hideOwned, hideWanted]}
              queryFn={fetchRecentGames}
              onStatusChange={handleStatusChange}
              onTrackGame={handleTrackGame}
              onToggleHidden={handleToggleHidden}
              isDiscovery={true}
            />

            {/* Upcoming Releases Section */}
            <GameCarouselSection
              title="Coming Soon"
              queryKey={["/api/igdb/upcoming", hiddenIgdbIds.size, hideOwned, hideWanted]}
              queryFn={fetchUpcomingGames}
              onStatusChange={handleStatusChange}
              onTrackGame={handleTrackGame}
              onToggleHidden={handleToggleHidden}
              isDiscovery={true}
            />

            {/* Studios Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Studios</h2>
              </div>
              {discoverStudios.length > 0 ? (
                <div className="overflow-x-auto pb-2" data-testid="discover-studios-row">
                  <div className="flex min-w-max gap-3">
                    {discoverStudios.map((studio) => {
                      const isActive = selectedStudio === studio.name;
                      return (
                        <button
                          key={studio.id}
                          type="button"
                          onClick={() => setSelectedStudio(studio.name)}
                          className={`group relative h-24 w-56 overflow-hidden rounded-xl border text-left transition-all ${
                            isActive
                              ? "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
                              : "border-white/10 hover:border-white/25"
                          }`}
                        >
                          {studio.coverUrl ? (
                            <img
                              src={studio.coverUrl}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover opacity-35"
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 to-slate-900/70" />
                          <div className="relative flex h-full flex-col justify-end p-3">
                            <p className="font-semibold text-white">{studio.name}</p>
                            <p className="text-xs text-slate-300">{studio.gameCount} titles</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No studio data available right now.
                </div>
              )}
              {selectedStudio && (
                <GameCarouselSection
                  title={`${selectedStudio} Picks`}
                  queryKey={[
                    "/api/igdb/studio",
                    selectedStudio,
                    hiddenIgdbIds.size,
                    hideOwned,
                    hideWanted,
                  ]}
                  queryFn={fetchGamesByStudio}
                  onStatusChange={handleStatusChange}
                  onTrackGame={handleTrackGame}
                  onToggleHidden={handleToggleHidden}
                  isDiscovery={true}
                />
              )}
            </div>

            {/* Collections Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Collections</h2>
              </div>
              {discoverCollections.length > 0 ? (
                <div className="overflow-x-auto pb-2" data-testid="discover-collections-row">
                  <div className="flex min-w-max gap-3">
                    {discoverCollections.map((collection) => {
                      const isActive = selectedCollection === collection.name;
                      return (
                        <button
                          key={collection.id}
                          type="button"
                          onClick={() => setSelectedCollection(collection.name)}
                          className={`group relative h-24 w-64 overflow-hidden rounded-xl border text-left transition-all ${
                            isActive
                              ? "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
                              : "border-white/10 hover:border-white/25"
                          }`}
                        >
                          {collection.coverUrl ? (
                            <img
                              src={collection.coverUrl}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover opacity-35"
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 to-slate-900/70" />
                          <div className="relative flex h-full flex-col justify-end p-3">
                            <p className="font-semibold text-white">{collection.name}</p>
                            <p className="text-xs text-slate-300">{collection.gameCount} titles</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No collection data available right now.
                </div>
              )}
              {selectedCollection && (
                <GameCarouselSection
                  title={`${selectedCollection} Collection`}
                  queryKey={[
                    "/api/igdb/collection",
                    selectedCollection,
                    hiddenIgdbIds.size,
                    hideOwned,
                    hideWanted,
                  ]}
                  queryFn={fetchGamesByCollection}
                  onStatusChange={handleStatusChange}
                  onTrackGame={handleTrackGame}
                  onToggleHidden={handleToggleHidden}
                  isDiscovery={true}
                />
              )}
            </div>

            {/* By Genre Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">By Genre</h2>
                <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                  <SelectTriggerWithSpinner
                    className="w-[180px]"
                    data-testid="select-genre"
                    loading={isFetchingGenres}
                  >
                    <SelectValue placeholder="Select genre" />
                  </SelectTriggerWithSpinner>
                  <SelectContent>
                    {displayGenres.map((genre: Genre) => (
                      <SelectItem key={genre.id} value={genre.name}>
                        {genre.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <GameCarouselSection
                title={`${selectedGenre} Games`}
                queryKey={[
                  "/api/igdb/genre",
                  debouncedGenre,
                  hiddenIgdbIds.size,
                  hideOwned,
                  hideWanted,
                ]}
                queryFn={fetchGamesByGenre}
                onStatusChange={handleStatusChange}
                onTrackGame={handleTrackGame}
                onToggleHidden={handleToggleHidden}
                isDiscovery={true}
              />
            </div>

            {/* By Platform Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold">By Platform</h2>
                  {isFetchingPlatforms && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="overflow-x-auto pb-1" data-testid="platform-chip-slider">
                  <div className="glass-surface inline-flex min-w-max items-center gap-2 rounded-xl px-2 py-2">
                    {displayPlatforms.map((platform: Platform) => {
                      const isSelected = selectedPlatform === platform.name;
                      return (
                        <Button
                          key={platform.id}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className={`rounded-full transition-all duration-300 ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.45)]"
                              : ""
                          }`}
                          onClick={() => setSelectedPlatform(platform.name)}
                          data-testid={`platform-chip-${platform.name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {platform.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <GameGrid
                games={platformGames}
                onStatusChange={handleStatusChange}
                onTrackGame={handleTrackGame}
                onToggleHidden={handleToggleHidden}
                isDiscovery={true}
                isLoading={isLoadingPlatformGames}
                isFetching={isFetchingPlatformGames}
              />
              <div
                className="flex flex-col items-center justify-center gap-2 py-2"
                ref={platformSentinelRef}
              >
                {isFetchingNextPage && (
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more {selectedPlatform} games...
                  </div>
                )}
                {!isLoadingPlatformGames && !hasNextPage && platformGames.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    No more {selectedPlatform} games available.
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => refetchPlatformGames()}>
                  Refresh {selectedPlatform}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rss" className="space-y-6">
            <div className="glass-surface flex justify-between items-center rounded-lg p-4">
              <div>
                <h3 className="font-semibold">RSS Feed Discovery</h3>
                <p className="text-sm text-muted-foreground">
                  Track releases from your favorite sites.
                </p>
              </div>
              <RssSettings />
            </div>
            <RssFeedList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
