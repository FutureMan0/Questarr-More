import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Star, Monitor, Tag, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Downloader, type Game } from "@shared/schema";
import GameDownloadDialog from "./GameDownloadDialog";

interface GameDetailsModalProps {
  game: Game | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GameDetailsModal({ game, open, onOpenChange }: GameDetailsModalProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [preferredDownloaderId, setPreferredDownloaderId] = useState("auto");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: downloaders = [] } = useQuery<Downloader[]>({
    queryKey: ["/api/downloaders/enabled"],
    enabled: open,
  });

  const removeGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/games/${gameId}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) throw new Error("Failed to remove game");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ description: "Game removed from collection" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to remove game", variant: "destructive" });
    },
  });

  if (!game) return null;

  const handleRemoveGame = () => {
    removeGameMutation.mutate(game.id);
  };

  const handleDownloadClick = () => {
    setDownloadOpen(true);
  };

  const hasDownloaders = downloaders.length > 0;
  const preferredLabel = useMemo(() => {
    if (preferredDownloaderId === "auto") return "Auto";
    return downloaders.find((d) => d.id === preferredDownloaderId)?.name || "Auto";
  }, [downloaders, preferredDownloaderId]);

  useEffect(() => {
    if (!open) return;
    const stillValid =
      preferredDownloaderId === "auto" || downloaders.some((d) => d.id === preferredDownloaderId);
    if (!stillValid) {
      setPreferredDownloaderId("auto");
    }
  }, [downloaders, open, preferredDownloaderId]);

  const SUMMARY_LIMIT = 280;
  const isSummaryLong = game.summary && game.summary.length > SUMMARY_LIMIT;
  const displaySummary =
    isSummaryLong && !isSummaryExpanded
      ? `${game.summary?.slice(0, SUMMARY_LIMIT)}...`
      : game.summary;
  const heroImage = game.screenshots?.[0] || game.coverUrl || "/placeholder-game-cover.jpg";
  const releaseDate = game.releaseDate ? new Date(game.releaseDate) : null;
  const releaseDateLabel = releaseDate ? releaseDate.toLocaleDateString() : "TBA";
  const releaseYear = releaseDate ? String(releaseDate.getFullYear()) : "TBA";
  const ratingLabel = game.rating ? `${game.rating}/10` : "N/A";
  const statusLabel = game.status
    ? `${game.status.charAt(0).toUpperCase()}${game.status.slice(1)}`
    : "Unknown";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[88vh] max-h-[88vh] max-w-[1100px] flex-col overflow-hidden border border-white/10 bg-[#050f23] p-0 text-slate-100">
          <DialogHeader className="sr-only">
            <DialogTitle data-testid={`text-game-title-${game.id}`}>{game.title}</DialogTitle>
            <DialogDescription>Detailed information about {game.title}</DialogDescription>
          </DialogHeader>

          <div className="relative flex min-h-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
              <img src={heroImage} alt="" className="h-full w-full object-cover opacity-40 blur-[1px]" />
              <div className="absolute inset-0 bg-gradient-to-b from-sky-400/25 via-[#071734]/80 to-[#050f23]" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#050f23]/40 via-transparent to-[#050f23]/60" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="relative space-y-6 p-5 pb-8 md:p-8">
                <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-4 backdrop-blur-md md:p-6">
                  <div className="grid gap-5 lg:grid-cols-[190px_1fr_290px]">
                    <div>
                      <img
                        src={game.coverUrl || "/placeholder-game-cover.jpg"}
                        alt={`${game.title} cover`}
                        className="w-full rounded-2xl border border-white/20 object-cover shadow-xl"
                        style={{ aspectRatio: "2 / 3" }}
                        data-testid={`img-cover-${game.id}`}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h2 className="text-3xl font-bold leading-tight text-white md:text-4xl">{game.title}</h2>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200/90">
                          <Badge className="border-emerald-400/50 bg-emerald-500/20 text-emerald-100">
                            {statusLabel}
                          </Badge>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-sky-300" />
                            {releaseYear}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-300" />
                            {ratingLabel}
                          </span>
                        </div>
                      </div>

                      {game.summary && (
                        <p className="text-sm leading-relaxed text-slate-200/85" data-testid={`text-summary-${game.id}`}>
                          {displaySummary}
                          {isSummaryLong && (
                            <Button
                              variant="link"
                              className="ml-1 h-auto p-0 font-semibold text-sky-300"
                              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                            >
                              {isSummaryExpanded ? "Show less" : "Read more"}
                            </Button>
                          )}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={preferredDownloaderId} onValueChange={setPreferredDownloaderId}>
                          <SelectTrigger className="h-10 w-[240px] border-white/20 bg-slate-900/80 text-slate-100">
                            <SelectValue placeholder="Choose provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto Provider</SelectItem>
                            {downloaders.map((downloader) => (
                              <SelectItem key={downloader.id} value={downloader.id}>
                                {downloader.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="default"
                          className="h-10 gap-2 rounded-xl bg-indigo-500 px-4 hover:bg-indigo-400"
                          onClick={handleDownloadClick}
                          disabled={!hasDownloaders}
                          data-testid="button-download-game"
                        >
                          <Download className="h-4 w-4" />
                          Request
                        </Button>

                        <Button
                          variant="outline"
                          className="h-10 gap-2 rounded-xl border-red-400/40 bg-red-900/20 text-red-100 hover:bg-red-900/35"
                          onClick={handleRemoveGame}
                          disabled={removeGameMutation.isPending}
                          data-testid={`button-remove-game-quick-${game.id}`}
                        >
                          <X className="h-4 w-4" />
                          {removeGameMutation.isPending ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    </div>

                    <Card className="rounded-2xl border border-white/15 bg-slate-950/75">
                      <CardContent className="space-y-3 p-4 text-sm">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-300">Provider</span>
                          <span className="font-medium text-white">{preferredLabel}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-300">Release Date</span>
                          <span className="font-medium text-white">{releaseDateLabel}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-slate-300">Rating</span>
                          <span className="font-medium text-white">{ratingLabel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Status</span>
                          <Badge className="border-white/20 bg-white/10 text-slate-100">{statusLabel}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <Card className="rounded-3xl border border-white/10 bg-slate-950/60">
                    <CardContent className="space-y-4 p-5">
                      {game.genres && game.genres.length > 0 && (
                        <div>
                          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                            <Tag className="h-4 w-4" />
                            Genres
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {game.genres.map((genre, index) => (
                              <Badge
                                key={index}
                                className="rounded-full border-white/20 bg-white/10 text-slate-100"
                                data-testid={`badge-genre-${genre.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {game.platforms && game.platforms.length > 0 && (
                        <div>
                          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
                            <Monitor className="h-4 w-4" />
                            Platforms
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {game.platforms.map((platform, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="rounded-full border-white/25 bg-slate-900/70 text-slate-100"
                                data-testid={`badge-platform-${platform.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {game.screenshots && game.screenshots.length > 0 && (
                    <Card className="rounded-3xl border border-white/10 bg-slate-950/60">
                      <CardContent className="p-5">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
                          Screenshots
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {game.screenshots.slice(0, 6).map((screenshot, index) => (
                            <Card
                              key={index}
                              className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 transition-transform hover:scale-[1.02] cursor-pointer"
                              onClick={() => setSelectedScreenshot(screenshot)}
                              data-testid={`screenshot-${index}`}
                            >
                              <CardContent className="p-0">
                                <img
                                  src={screenshot}
                                  alt={`${game.title} screenshot ${index + 1}`}
                                  className="h-28 w-full object-cover"
                                />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </section>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Screenshot Lightbox */}
      {selectedScreenshot && (
        <Dialog open={!!selectedScreenshot} onOpenChange={() => setSelectedScreenshot(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Screenshot</DialogTitle>
              <DialogDescription className="sr-only">Full size game screenshot</DialogDescription>
            </DialogHeader>{" "}
            <div className="flex justify-center">
              <img
                src={selectedScreenshot}
                alt={`${game.title} screenshot`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                data-testid="screenshot-lightbox"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <GameDownloadDialog
        game={game}
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        preferredDownloaderId={preferredDownloaderId === "auto" ? undefined : preferredDownloaderId}
      />
    </>
  );
}
