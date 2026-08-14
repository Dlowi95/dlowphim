function matchesRouteOrChild(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

const MOBILE_NAV_HIDDEN_ROUTES = [
  "/sys-dlowadmin",
  "/watch-together/room",
  "/watch-together/create",
];

export function shouldHideMobileNavigation(pathname: string) {
  return MOBILE_NAV_HIDDEN_ROUTES.some((route) =>
    matchesRouteOrChild(pathname, route),
  );
}
