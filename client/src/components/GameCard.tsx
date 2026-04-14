import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Info, Eye, EyeOff, Loader2, Check, Minus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { type GameStatus } from "./StatusBadge";
import { type Game } from "@shared/schema";
import { useState, memo, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import GameDetailsModal from "./GameDetailsModal";
import GameDownloadDialog from "./GameDownloadDialog";
import { mapGameToInsertGame, isDiscoveryId } from "@/lib/utils";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getConsoleChip, getOwnershipStatusChip } from "@/lib/game-card-presenter";

interface GameCardProps {
  game: Game;
  onStatusChange?: (gameId: string, newStatus: GameStatus) => void;
  onViewDetails?: (gameId: string) => void;
  onTrackGame?: (game: Game) => void;
  onToggleHidden?: (gameId: string, hidden: boolean) => void;
  isDiscovery?: boolean;
  layout?: "grid" | "carousel";
}

// ⚡ Bolt: Using React.memo to prevent unnecessary re-renders of the GameCard
// when parent components update but this card's props remain unchanged.
// This is particularly effective in grids or lists where many cards are rendered.
const GameCard = ({
  game,
  onStatusChange,
  onViewDetails,
  onToggleHidden,
  isDiscovery = false,
  layout = "grid",
}: GameCardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // Keep track of the resolved game object (either original or newly added)
  const [resolvedGame, setResolvedGame] = useState<Game>(game);

  // Update resolved game if props change
  useEffect(() => {
    setResolvedGame(game);
  }, [game]);

  // For auto-adding games when downloading from Discovery
  const addGameMutation = useMutation<Game, Error, Game>({
    mutationFn: async (game: Game) => {
      const gameData = mapGameToInsertGame(game);

      try {
        const response = await apiRequest("POST", "/api/games", {
          ...gameData,
          status: "wanted",
        });
        return response.json() as Promise<Game>;
      } catch (error) {
        // Handle 409 Conflict (already in library)
        if (error instanceof ApiError && error.status === 409) {
          const data = error.data as Record<string, unknown>;
          if (data?.game) {
            return data.game as Game;
          }
          // Fallback if data format is unexpected but we know it's a 409
          return game;
        }
        throw error;
      }
    },
    onSuccess: (newGame) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setResolvedGame(newGame);
    },
  });

  const statusChip = getOwnershipStatusChip(game.status);
  const consoleChip = getConsoleChip(game);
  const isCarouselLayout = layout === "carousel";
  const StatusIcon = statusChip.icon === "check" ? Check : statusChip.icon === "minus" ? Minus : X;

  const handleStatusClick = () => {
    const nextStatus: GameStatus =
      game.status === "wanted" ? "owned" : game.status === "owned" ? "completed" : "wanted";
    onStatusChange?.(game.id, nextStatus);
  };

  const handleDetailsClick = () => {
    setDetailsOpen(true);
    onViewDetails?.(game.id);
  };

  const handleDownloadClick = async () => {
    // If it's a discovery game (temporary ID), add it to library first
    if (isDiscoveryId(resolvedGame.id)) {
      try {
        const gameInLibrary = await addGameMutation.mutateAsync(resolvedGame);
        // Note: resolvedGame is updated in onSuccess, but we use gameInLibrary here
        // to be absolutely sure we have the latest version for the dialog
        setResolvedGame(gameInLibrary);
        setDownloadOpen(true);
      } catch {
        toast({
          description: "Failed to add game to library before downloading",
          variant: "destructive",
        });
      }
    } else {
      setDownloadOpen(true);
    }
  };

  const handleToggleHidden = () => {
    onToggleHidden?.(game.id, !game.hidden);
  };

  return (
    <Card
      ref={cardRef}
      className={`group mx-auto flex h-full w-full flex-col overflow-hidden border border-white/10 bg-slate-950/90 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_22px_40px_-28px_rgba(0,0,0,0.95)] ${isCarouselLayout ? "max-w-none rounded-[22px]" : "max-w-[245px] rounded-[18px]"} ${game.hidden ? "opacity-60 grayscale" : ""}`}
      data-testid={`card-game-${game.id}`}
    >
      <div className="relative">
        <img
          src={game.coverUrl || "/placeholder-game-cover.jpg"}
          alt={`${game.title} cover`}
          className="aspect-[11/16] w-full cursor-pointer object-cover"
          onClick={handleDetailsClick}
          loading="lazy"
          data-testid={`img-cover-${game.id}`}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <Badge
            variant="outline"
            className={`h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-normal shadow-sm backdrop-blur-sm ${consoleChip.className}`}
          >
            {consoleChip.label}
          </Badge>
          {statusChip.visible && (
            <Badge
              variant="outline"
              className={`h-8 w-8 rounded-full border-0 bg-white/95 p-0 text-[10px] shadow-md ring-1.5 backdrop-blur-sm flex items-center justify-center ${statusChip.className}`}
            >
              <StatusIcon className="h-[18px] w-[18px]" strokeWidth={2.9} />
            </Badge>
          )}
        </div>
        <div
          onClick={(e) => e.stopPropagation()}
          className={`pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 ${isCarouselLayout ? "" : "rounded-t-md"}`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                onClick={handleDetailsClick}
                aria-label={`View details for ${game.title}`}
                data-testid={`button-details-${game.id}`}
              >
                <Info className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Details</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="default"
                onClick={handleDownloadClick}
                disabled={addGameMutation.isPending}
                aria-label={`Download ${game.title}`}
                data-testid={`button-download-${game.id}`}
              >
                {addGameMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download</p>
            </TooltipContent>
          </Tooltip>

          {game.hidden && (
            <Badge variant="secondary" className="text-xs bg-gray-500 text-white">
              Hidden
            </Badge>
          )}

          {!isDiscovery && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleToggleHidden}
                  aria-label={game.hidden ? `Unhide ${game.title}` : `Hide ${game.title}`}
                  data-testid={`button-toggle-hidden-${game.id}`}
                >
                  {game.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{game.hidden ? "Unhide Game" : "Hide Game"}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <CardContent
        className="flex flex-1 flex-col space-y-2 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="line-clamp-2 min-h-9 text-sm font-semibold leading-[1.2rem]"
          data-testid={`text-title-${game.id}`}
        >
          {game.title}
        </h3>
        {!isCarouselLayout && (
          <div className="flex min-h-9 flex-wrap content-start gap-1">
            {game.genres?.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="rounded-sm bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                data-testid={`tag-genre-${genre.toLowerCase()}`}
              >
                {genre}
              </span>
            )) || <span className="text-xs text-muted-foreground">No genres</span>}
          </div>
        )}

        {isCarouselLayout && (
          <p className="line-clamp-1 min-h-3.5 text-xs text-muted-foreground">
            {game.genres?.[0] || "No genre"}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleDetailsClick}
            data-testid={`button-details-inline-${game.id}`}
            aria-label={`Open details for ${game.title}`}
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant={isDiscovery ? "default" : "outline"}
            size="sm"
            className={`flex-1 ${isDiscovery ? "bg-blue-700 text-blue-50 hover:bg-blue-600" : ""}`}
            onClick={isDiscovery ? handleDownloadClick : handleStatusClick}
            disabled={addGameMutation.isPending}
            data-testid={isDiscovery ? `button-track-${game.id}` : `button-status-${game.id}`}
          >
            {isDiscovery ? (
              addGameMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Requesting...
                </>
              ) : (
                "Request"
              )
            ) : (
              `Mark as ${
                game.status === "wanted" ? "Owned" : game.status === "owned" ? "Completed" : "Wanted"
              }`
            )}
          </Button>
        </div>
      </CardContent>

      {/* ⚡ Bolt: Conditionally render modals only when they are active.
          This prevents rendering hundreds of hidden, complex components on pages
          with many game cards, significantly improving initial render performance
          and reducing memory usage. */}
      {detailsOpen && (
        <GameDetailsModal game={resolvedGame} open={detailsOpen} onOpenChange={setDetailsOpen} />
      )}

      {downloadOpen && (
        <GameDownloadDialog
          game={resolvedGame}
          open={downloadOpen}
          onOpenChange={setDownloadOpen}
        />
      )}
    </Card>
  );
};

export default memo(GameCard);
