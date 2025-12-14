/**
 * Manages ongoing requests per group to enable cancellation
 */
class RequestManager {
  private abortControllers: Map<string, AbortController> = new Map();

  /**
   * Cancel any ongoing request for a group and create a new AbortController
   * @param groupId - The group ID
   * @returns New AbortController for this group
   */
  cancelAndCreate(groupId: string): AbortController {
    // Cancel previous request if exists
    const existingController = this.abortControllers.get(groupId);
    if (existingController) {
      console.log(`Cancelling previous request for group ${groupId}`);
      existingController.abort();
    }

    // Create new controller
    const newController = new AbortController();
    this.abortControllers.set(groupId, newController);
    return newController;
  }

  /**
   * Remove the AbortController for a group (after request completes)
   * @param groupId - The group ID
   */
  remove(groupId: string) {
    this.abortControllers.delete(groupId);
  }

  /**
   * Get the current AbortController for a group
   * @param groupId - The group ID
   * @returns AbortController or undefined
   */
  get(groupId: string): AbortController | undefined {
    return this.abortControllers.get(groupId);
  }
}

export const requestManager = new RequestManager();

