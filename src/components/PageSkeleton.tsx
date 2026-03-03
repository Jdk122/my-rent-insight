const PageSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Nav placeholder */}
    <div className="h-[56px] bg-card border-b border-border/50" />
    
    <div className="max-w-[720px] mx-auto px-6 pt-12 space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-48 bg-muted rounded" />
      
      {/* Title */}
      <div className="h-8 w-80 bg-muted rounded" />
      
      {/* Description */}
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted/60 rounded" />
        <div className="h-4 w-3/4 bg-muted/60 rounded" />
      </div>

      {/* Content blocks */}
      <div className="grid grid-cols-2 gap-4 pt-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/40 rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

export default PageSkeleton;
