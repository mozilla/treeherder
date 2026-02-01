import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Custom hook that provides navigation utilities compatible with the old
 * connected-react-router pushRoute pattern.
 *
 * @returns {Object} Navigation utilities
 */
export const useRouterNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Navigate with search params, compatible with connected-react-router push
   * @param {Object} options - Navigation options
   * @param {string} options.search - Search string (query params)
   * @param {string} options.pathname - Optional pathname
   */
  const pushRoute = useCallback(
    ({ search, pathname }) => {
      navigate({
        pathname: pathname || location.pathname,
        search: search || location.search,
      });
    },
    [navigate, location.pathname, location.search],
  );

  return {
    navigate,
    location,
    searchParams,
    setSearchParams,
    pushRoute,
  };
};

/**
 * Utility function to update URL without React Router
 * Used in Redux actions where hooks aren't available
 * @param {string} search - Query string to set
 */
export const updateUrlSearch = (search) => {
  const newUrl = `${window.location.pathname}?${search}`;
  window.history.pushState({}, '', newUrl);
};

/**
 * Utility function to replace URL without React Router
 * Used in Redux actions where hooks aren't available
 * @param {string} search - Query string to set
 */
export const replaceUrlSearch = (search) => {
  const newUrl = `${window.location.pathname}?${search}`;
  window.history.replaceState({}, '', newUrl);
};
