import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Game } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import GameGrid from "./GameGrid";
import GameCard from "./GameCard";
import DisplaySettingsModal from "./DisplaySettingsModal";
import { type GameStatus } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface DashboardSectionsResponse {
  recentlyAdded: Game[];
  recentRequests: Game[];
  trending: Game[];
  all: Game[];
}

interface DashboardCarouselSectionProps {
  title: string;
  subtitle: string;
  games: Game[];
  isDiscovery?: boolean;
  isLoading?: boolean;
  onStatusChange: (gameId: string, status: GameStatus) => void;
  onToggleHidden: (gameId: string, hidden: boolean) => void;
}

function DashboardCarouselSection({
  title,
  subtitle,
  games,
  isDiscovery = false,
  isLoading = false,
  onStatusChange,
  onToggleHidden,
}: DashboardCarouselSectionProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!api) return;

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    updateScrollState();
    api.on("reInit", updateScrollState);
    api.on("select", updateScrollState);
    return () => {
      api.off("reInit", updateScrollState);
      api.off("select", updateScrollState);
    };
  }, [api]);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => api?.scrollPrev()}
            disabled={!canScrollPrev}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => api?.scrollNext()}
            disabled={!canScrollNext}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="w-[240px] shrink-0 space-y-2">
              <Skeleton className="aspect-[9/16] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-sm text-muted-foreground">
            No games in this section.
          </CardContent>
        </Card>
      ) : (
        <Carousel
          opts={{ align: "start", loop: false }}
          setApi={setApi}
          className="w-full max-w-full overflow-hidden"
        >
          <CarouselContent className="-ml-4 items-stretch">
            {games.map((game) => (
              <CarouselItem
                key={game.id}
                className="pl-4 h-full basis-[78%] sm:basis-[48%] md:basis-[36%] lg:basis-[28%] xl:basis-[22%] 2xl:basis-[18%]"
              >
                <GameCard
                  game={game}
                  onStatusChange={onStatusChange}
                  onToggleHidden={onToggleHidden}
                  isDiscovery={isDiscovery}
                  layout="carousel"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      )}
    </section>
  );
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GameStatus | "all">("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const [gridColumns, setGridColumns] = useState<number>(() => {
    const saved = localStorage.getItem("dashboardGridColumns");
    return saved ? parseInt(saved, 10) : 5;
  });
  const [showHiddenGames, setShowHiddenGames] = useState<boolean>(
    () => localStorage.getItem("showHiddenGames") === "true"
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("dashboardViewMode") as "grid" | "list") || "grid"
  );
  const [listDensity, setListDensity] = useState<"comfortable" | "compact" | "ultra-compact">(
    () =>
      (localStorage.getItem("dashboardListDensity") as
        | "comfortable"
        | "compact"
        | "ultra-compact") || "comfortable"
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem("dashboardGridColumns", gridColumns.toString());
  }, [gridColumns]);
  useEffect(() => {
    localStorage.setItem("showHiddenGames", showHiddenGames.toString());
  }, [showHiddenGames]);
  useEffect(() => {
    localStorage.setItem("dashboardViewMode", viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem("dashboardListDensity", listDensity);
  }, [listDensity]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") || "";
    setSearchQuery(initialQuery);

    const handleDashboardSearch = (event: Event) => {
      const customEvent = event as CustomEvent<{ query?: string }>;
      setSearchQuery(customEvent.detail?.query ?? "");
    };

    window.addEventListener("questarr-dashboard-search", handleDashboardSearch);
    return () => {
      window.removeEventListener("questarr-dashboard-search", handleDashboardSearch);
    };
  }, []);

  const { data: sections, isLoading, isFetching } = useQuery<DashboardSectionsResponse>({
    queryKey: ["/api/dashboard/sections", debouncedSearchQuery, showHiddenGames],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchQuery.trim()) params.set("search", debouncedSearchQuery.trim());
      if (showHiddenGames) params.set("includeHidden", "true");
      params.set("limit", "24");

      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`/api/dashboard/sections?${params.toString()}`, { headers });
      if (!response.ok) throw new Error("Failed to fetch dashboard sections");
      return response.json();
    },
  });

  const allGames = sections?.all ?? [];

  const statusMutation = useMutation({
    mutationFn: async ({ gameId, status }: { gameId: string; status: GameStatus }) => {
      const response = await apiRequest("PATCH", `/api/games/${gameId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ description: "Game status updated." });
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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ description: "Visibility updated." });
    },
    onError: () => {
      toast({ description: "Could not update visibility.", variant: "destructive" });
    },
  });

  const uniqueGenres = useMemo(
    () => Array.from(new Set(allGames.flatMap((game) => game.genres ?? []))).sort(),
    [allGames]
  );
  const uniquePlatforms = useMemo(
    () => Array.from(new Set(allGames.flatMap((game) => game.platforms ?? []))).sort(),
    [allGames]
  );

  const filteredAllGames = useMemo(() => {
    return allGames.filter((game) => {
      if (statusFilter !== "all" && game.status !== statusFilter) return false;
      if (genreFilter !== "all" && !game.genres?.includes(genreFilter)) return false;
      if (platformFilter !== "all" && !game.platforms?.includes(platformFilter)) return false;
      return true;
    });
  }, [allGames, statusFilter, genreFilter, platformFilter]);

  const activeFilters = useMemo(() => {
    const filters: string[] = [];
    if (statusFilter !== "all") filters.push(`Status: ${statusFilter}`);
    if (genreFilter !== "all") filters.push(`Genre: ${genreFilter}`);
    if (platformFilter !== "all") filters.push(`Platform: ${platformFilter}`);
    return filters;
  }, [statusFilter, genreFilter, platformFilter]);

  const handleStatusChange = useCallback(
    (gameId: string, status: GameStatus) => {
      statusMutation.mutate({ gameId, status });
    },
    [statusMutation]
  );

  const handleToggleHidden = useCallback(
    (gameId: string, hidden: boolean) => {
      hiddenMutation.mutate({ gameId, hidden });
    },
    [hiddenMutation]
  );

  const clearAllFilters = useCallback(() => {
    setStatusFilter("all");
    setGenreFilter("all");
    setPlatformFilter("all");
  }, []);

  const requestsCount = sections?.recentRequests.length ?? 0;
  const recentlyAddedCount = sections?.recentlyAdded.length ?? 0;
  const trendingCount = sections?.trending.length ?? 0;

  return (
    <div className="h-full overflow-auto p-6 md:p-8" data-testid="layout-dashboard">
      <div className="mx-auto max-w-[1700px] space-y-8">
        <div className="-mx-2 px-2 pb-3 pt-1">
          <Card className="relative overflow-hidden border border-border/70 bg-gradient-to-br from-background via-background to-primary/5">
            <CardContent className="relative z-10 space-y-5 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-cyan-300/45 bg-cyan-500/15 text-cyan-100">
                {recentlyAddedCount} Recently Added
              </Badge>
              <Badge
                variant="outline"
                className="border-violet-300/45 bg-violet-500/15 text-violet-100"
              >
                {requestsCount} Recent Requests
              </Badge>
              <Badge variant="outline" className="border-emerald-300/45 bg-emerald-500/15 text-emerald-100">
                {trendingCount} Trending
              </Badge>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Discover your next download faster</h1>
              <p className="text-sm text-muted-foreground">
                Search on top, then jump into your key rows: Recently Added, Recent Requests,
                Trending, and your complete collection below.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Search is now integrated into the top header bar.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters((prev) => !prev)}>
                  Filters
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDisplaySettings(true)}>
                  Layout
                </Button>
              </div>
            </div>
            </CardContent>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/60 via-violet-400/55 to-emerald-400/60" />
            <div className="pointer-events-none absolute -left-20 top-10 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          </Card>

          {showFilters && (
            <Card className="mt-3">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Filters</Label>
                  {activeFilters.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-2">
                      <X className="h-4 w-4" />
                      Clear All
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value as GameStatus | "all")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="wanted">Wanted</SelectItem>
                        <SelectItem value="owned">Owned</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="downloading">Downloading</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <Select value={genreFilter} onValueChange={setGenreFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genres</SelectItem>
                        {uniqueGenres.map((genre) => (
                          <SelectItem key={genre} value={genre}>
                            {genre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Platforms</SelectItem>
                        {uniquePlatforms.map((platform) => (
                          <SelectItem key={platform} value={platform}>
                            {platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-10">
          <DashboardCarouselSection
            title="Recently Added"
            subtitle="Recently added to your library"
            games={sections?.recentlyAdded ?? []}
            isLoading={isLoading}
            onStatusChange={handleStatusChange}
            onToggleHidden={handleToggleHidden}
          />

          <DashboardCarouselSection
            title="Recent Requests"
            subtitle="Wanted titles and active downloads at a glance"
            games={sections?.recentRequests ?? []}
            isLoading={isLoading}
            onStatusChange={handleStatusChange}
            onToggleHidden={handleToggleHidden}
          />

          <DashboardCarouselSection
            title="Trending"
            subtitle="Current popular picks from IGDB"
            games={sections?.trending ?? []}
            isDiscovery
            isLoading={isLoading}
            onStatusChange={handleStatusChange}
            onToggleHidden={handleToggleHidden}
          />

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">All</h2>
              <p className="text-sm text-muted-foreground">
                Your complete collection with filters and layout options
              </p>
            </div>
            <GameGrid
              games={filteredAllGames}
              onStatusChange={handleStatusChange}
              onToggleHidden={handleToggleHidden}
              isLoading={isLoading}
              isFetching={isFetching}
              columns={gridColumns}
              viewMode={viewMode}
              density={listDensity}
            />
          </section>
        </div>
      </div>

      <DisplaySettingsModal
        open={showDisplaySettings}
        onOpenChange={setShowDisplaySettings}
        gridColumns={gridColumns}
        onGridColumnsChange={setGridColumns}
        showHiddenGames={showHiddenGames}
        onShowHiddenGamesChange={setShowHiddenGames}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        density={listDensity}
        onDensityChange={setListDensity}
      />
    </div>
  );
}
