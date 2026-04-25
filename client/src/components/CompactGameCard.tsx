import React, { memo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  Info,
  Star,
  Calendar,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Minus,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { type GameStatus } from "./StatusBadge";
import { type Game } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import GameDownloadDialog from "./GameDownloadDialog";
import { mapGameToInsertGame, isDiscoveryId, cn } from "@/lib/utils";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getConsoleChip, getOwnershipStatusChip } from "@/lib/game-card-presenter";
import { useLocation } from "wouter";

interface CompactGameCardProps {
  game: Game;
  onStatusChange?: (gameId: string, newStatus: GameStatus) => void;
  onViewDetails?: (gameId: string) => void;
  onToggleHidden?: (gameId: string, hidden: boolean) => void;
  onRequestSearch?: (gameId: string) => void;
  onRemoveRequest?: (gameId: string) => void;
  isDiscovery?: boolean;
  isRequestView?: boolean;
  density?: "comfortable" | "compact" | "ultra-compact";
}

function getReleaseStatus(game: Game): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  isReleased: boolean;
  className?: string;
} {
  if (game.releaseStatus === "delayed") {
    return { label: "Delayed", variant: "destructive", isReleased: false };
  }

  if (!game.releaseDate) return { label: "TBA", variant: "secondary", isReleased: false };

  const now = new Date();
  const release = new Date(game.releaseDate);

  if (release > now) {
    return { label: "Upcoming", variant: "default", isReleased: false };
  }
  return {
    label: "Released",
    variant: "outline",
    isReleased: true,
    className: "bg-green-500 border-green-600 text-white",
  };
}

const getNextStatusInfo = (status: GameStatus): { id: GameStatus; label: string } => {
  if (status === "wanted") return { id: "owned", label: "Owned" };
  if (status === "owned") return { id: "completed", label: "Completed" };
  return { id: "wanted", label: "Wanted" };
};

const CompactGameCard = ({
  game,
  onStatusChange,
  onViewDetails,
  onToggleHidden,
  isDiscovery = false,
  density = "comfortable",
}: CompactGameCardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [, navigate] = useLocation();
  const releaseStatus = getReleaseStatus(game);
  const statusChip = getOwnershipStatusChip(game.status);
  const consoleChip = getConsoleChip(game);
  const StatusIcon = statusChip.icon === "check" ? Check : statusChip.icon === "minus" ? Minus : X;

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

  const handleStatusClick = () => {
    onStatusChange?.(game.id, getNextStatusInfo(game.status).id);
  };

  const handleDetailsClick = () => {
    const detailsId =
      isDiscoveryId(resolvedGame.id) && resolvedGame.igdbId
        ? `igdb-${resolvedGame.igdbId}`
        : resolvedGame.id;
    navigate(`/games/${detailsId}`);
    onViewDetails?.(game.id);
  };

  const handleDownloadClick = async () => {
    // If it's a discovery game (temporary ID), add it to library first
    if (isDiscoveryId(resolvedGame.id)) {
      try {
        const gameInLibrary = await addGameMutation.mutateAsync(resolvedGame);
        setResolvedGame(gameInLibrary);
        setDownloadOpen(true);
      } catch (error) {
        console.error("Failed to add game to library before downloading:", error);
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
    <>
      <div
        className={cn(
          "group relative flex items-center transition-colors hover:bg-accent/50",
          game.hidden && "opacity-60 grayscale",
          density === "comfortable" &&
            "gap-3 p-2.5 rounded-[16px] border border-white/10 bg-slate-950/85 text-card-foreground shadow-sm",
          density === "compact" &&
            "gap-3 py-1.5 px-2 border-b border-slate-700/50 bg-transparent rounded-none",
          density === "ultra-compact" &&
            "gap-2 py-1 px-2 border-b border-slate-700/50 bg-transparent rounded-none"
        )}
        data-testid={`card-game-compact-${game.id}`}
      >
        {density !== "comfortable" && statusChip.visible && (
          <Badge
            variant="outline"
            className={cn(
              "absolute right-2 top-2 z-10 h-[22px] w-[22px] rounded-full border-0 bg-white/95 p-0 text-[10px] ring-1.5 flex items-center justify-center",
              statusChip.className
            )}
          >
            <StatusIcon className="h-3 w-3" strokeWidth={2.8} />
          </Badge>
        )}

        {/* Cover Image */}
        {density !== "ultra-compact" && (
          <div
            className={cn(
              "flex-shrink-0 relative overflow-hidden bg-muted",
              density === "comfortable" ? "w-16 h-24 rounded" : "w-8 h-8 rounded-sm"
            )}
          >
            <img
              src={game.coverUrl || "/placeholder-game-cover.jpg"}
              alt={`${game.title} cover`}
              className="w-full h-full cursor-pointer object-cover"
              onClick={handleDetailsClick}
              loading="lazy"
              data-testid={`img-cover-${game.id}`}
            />
            {density === "comfortable" && (
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1">
                <Badge
                  variant="outline"
                  className={`h-[26px] rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-normal ${consoleChip.className}`}
                >
                  {consoleChip.label}
                </Badge>
                {statusChip.visible && (
                  <Badge
                    variant="outline"
                    className={`h-[26px] w-[26px] rounded-full border-0 bg-white/95 p-0 text-[9px] ring-1.5 flex items-center justify-center ${statusChip.className}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.9} />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "flex-grow min-w-0 flex",
            density === "ultra-compact" ? "flex-row items-center gap-4" : "flex-col gap-0.5"
          )}
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3
              className={cn(
                "font-semibold truncate",
                density === "comfortable" ? "text-base" : "text-sm"
              )}
              data-testid={`text-title-${game.id}`}
            >
              {game.title}
            </h3>
            {density !== "comfortable" && (
              <>
                <Badge
                  variant="outline"
                  className={`h-7 px-2 text-[10px] font-bold ${consoleChip.className}`}
                >
                  {consoleChip.label}
                </Badge>
              </>
            )}
          </div>

          <div
            className={cn(
              "flex items-center text-muted-foreground",
              density === "ultra-compact" ? "gap-3 text-xs ml-auto" : "gap-4 text-xs"
            )}
          >
            {/* Rating */}
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-accent" />
              <span>{game.rating ? `${game.rating}/10` : "N/A"}</span>
            </div>

            {/* Release Date */}
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{game.releaseDate || "TBA"}</span>
            </div>

            {/* Release Status Badge */}
            {game.status === "wanted" && (
              <Badge
                variant={releaseStatus.variant}
                className={`text-[10px] h-5 px-1.5 ${releaseStatus.className || ""}`}
              >
                {releaseStatus.label}
              </Badge>
            )}

            {/* Hidden Badge */}
            {game.hidden && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] h-5 px-1.5 bg-gray-500 text-white",
                  density !== "comfortable" ? "h-4 px-1 text-[9px]" : ""
                )}
              >
                Hidden
              </Badge>
            )}

            {/* Genres */}
            {density !== "comfortable" && (
              <div
                className={cn(
                  "hidden sm:flex items-center",
                  density === "ultra-compact" ? "gap-2 ml-4 border-l pl-4" : "gap-1"
                )}
              >
                {game.genres && game.genres.length > 0 ? (
                  <span className="truncate max-w-[200px]">
                    {game.genres.slice(0, 3).join(" • ")}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Genres (Comfortable Mode) */}
          {density === "comfortable" && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {game.genres && game.genres.length > 0 ? (
                game.genres.slice(0, 3).map((genre) => (
                  <span key={genre} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm">
                    {genre}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-muted-foreground">No genres</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className={cn(
            "flex items-center self-center",
            density === "ultra-compact" ? "gap-1 ml-4" : "gap-2"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isDiscovery ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="default"
                  className={cn(
                    "transition-all",
                    density !== "comfortable" ? "h-6 w-6" : "h-8 w-8"
                  )}
                  onClick={handleDownloadClick}
                  disabled={addGameMutation.isPending}
                  aria-label={`Download ${game.title}`}
                >
                  {addGameMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className={density !== "comfortable" ? "w-3 h-3" : "w-4 h-4"} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "hidden sm:flex",
                density !== "comfortable"
                  ? "h-6 w-6 p-0 border-0 hover:bg-slate-700"
                  : "h-8 text-xs"
              )}
              onClick={handleStatusClick}
              aria-label={`Mark ${game.title} as ${getNextStatusInfo(game.status).label}`}
            >
              {density !== "comfortable" ? (
                game.status === "wanted" ? (
                  <span title="Mark Owned">📂</span>
                ) : game.status === "owned" ? (
                  <span title="Mark Completed">✔</span>
                ) : (
                  <span title="Mark Wanted">★</span>
                )
              ) : (
                `Mark ${getNextStatusInfo(game.status).label}`
              )}
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn("transition-all", density !== "comfortable" ? "h-6 w-6" : "h-8 w-8")}
                onClick={handleDetailsClick}
                aria-label={`View details for ${game.title}`}
              >
                <Info className={density !== "comfortable" ? "w-3 h-3" : "w-4 h-4"} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View Details</TooltipContent>
          </Tooltip>

          {!isDiscovery && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "transition-all",
                    density !== "comfortable" ? "h-6 w-6" : "h-8 w-8"
                  )}
                  onClick={handleToggleHidden}
                  aria-label={game.hidden ? `Unhide ${game.title}` : `Hide ${game.title}`}
                >
                  {game.hidden ? (
                    <Eye className={density !== "comfortable" ? "w-3 h-3" : "w-4 h-4"} />
                  ) : (
                    <EyeOff className={density !== "comfortable" ? "w-3 h-3" : "w-4 h-4"} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{game.hidden ? "Unhide" : "Hide"}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {downloadOpen && (
        <GameDownloadDialog
          game={resolvedGame}
          open={downloadOpen}
          onOpenChange={setDownloadOpen}
        />
      )}
    </>
  );
};

export default memo(CompactGameCard);
