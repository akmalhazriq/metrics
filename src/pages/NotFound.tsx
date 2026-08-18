const NotFound = () => {
  return (
    <div className="mt-28 min-h-screen px-4 text-center">
      <h1 className="text-4xl font-bold">We couldn't find that page</h1>
      <p className="text-muted-foreground mt-3 text-lg">
        It might have been moved, or the link is wrong. Try going back or head to your dashboards.
      </p>
      <a href="/welcome" className="text-primary mt-6 inline-block text-sm hover:underline">
        Go to Welcome
      </a>
    </div>
  );
};

export default NotFound;
