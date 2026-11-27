import {
  ApplicationCommandType,
  Routes,
  type REST,
  type RESTGetAPIApplicationCommandsResult,
  type RESTPostAPIPrimaryEntryPointApplicationCommandJSONBody,
} from 'discord.js';

/** Keep Discord's Activity launcher when Sapphire replaces global commands. */
export function preserveActivityEntryPoint(
  rest: Pick<REST, 'get' | 'put'>,
  applicationId: string,
): void {
  const globalCommands = Routes.applicationCommands(applicationId);
  const put = rest.put.bind(rest);
  rest.put = async (route, options) => {
    if (route !== globalCommands || !Array.isArray(options?.body)) {
      return put(route, options);
    }
    const current = (await rest.get(route, {
      query: new URLSearchParams({ with_localizations: 'true' }),
    })) as RESTGetAPIApplicationCommandsResult;
    const entryPoint = current.find(
      ({ type }) => type === ApplicationCommandType.PrimaryEntryPoint,
    );
    if (!entryPoint) return put(route, options);

    const preserved: RESTPostAPIPrimaryEntryPointApplicationCommandJSONBody = {
      type: ApplicationCommandType.PrimaryEntryPoint,
      name: entryPoint.name,
      description: entryPoint.description,
      handler: entryPoint.handler,
      name_localizations: entryPoint.name_localizations,
      description_localizations: entryPoint.description_localizations,
      default_member_permissions: entryPoint.default_member_permissions,
      integration_types: entryPoint.integration_types,
      contexts: entryPoint.contexts ?? undefined,
      nsfw: entryPoint.nsfw,
    };
    const result = await put(route, {
      ...options,
      body: [...options.body, preserved],
    });
    // Sapphire only owns commands with registered pieces.
    return Array.isArray(result)
      ? result.filter(
          ({ type }) => type !== ApplicationCommandType.PrimaryEntryPoint,
        )
      : result;
  };
}
