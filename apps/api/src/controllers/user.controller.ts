import * as contract from '@marquinhos/contracts/http/routes/user';
import type { Request, Response } from 'express';
import { UserService } from 'services/user';
import { parseRequest, sendContract } from 'utils/contract';

class UserController {
  constructor(private userService: UserService = new UserService()) {}

  public async enableLastfm(req: Request, res: Response) {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    const input = parseRequest(contract.enableLastfm, req);
    if (!input) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    try {
      await this.userService.enableLastfm(req.user.id, input.body.token);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }

    return sendContract(res, contract.enableLastfm, {
      message: 'Lastfm enabled',
    });
  }

  public async getProfile(req: Request, res: Response) {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    return sendContract(res, contract.getProfile, req.user);
  }

  public async toggleScrobbles(req: Request, res: Response) {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      return sendContract(
        res,
        contract.toggleScrobbles,
        await this.userService.toggleScrobbles(req.user.id),
      );
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async deleteLastfmData(req: Request, res: Response) {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      await this.userService.deleteLastfmData(req.user.id);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }

    return sendContract(res, contract.deleteLastfmData, {
      message: 'User deleted',
    });
  }

  public async deleteAllData(req: Request, res: Response) {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      await this.userService.deleteAllData(req.user.id);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }

    return sendContract(res, contract.deleteAllData, {
      message: 'User deleted',
    });
  }

  public async exists(req: Request, res: Response) {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      const input = parseRequest(contract.exists, req);
      if (!input) {
        return res.status(400).json({ message: 'id is required' });
      }
      return sendContract(
        res,
        contract.exists,
        await this.userService.exists(input.params.id),
      );
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async lastfmStatus(req: Request, res: Response) {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      const lastfmStatus = await this.userService.hasValidLastfmSessionToken(
        req.user.id,
      );

      if (lastfmStatus) {
        return sendContract(res, contract.lastfmStatus, lastfmStatus);
      } else {
        return res.status(404).json({ message: 'Lastfm token not found' });
      }
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async getTopArtists(req: Request, res: Response) {
    const input = parseRequest(contract.getTopArtists, req);
    if (!input) {
      return res.status(400).json({ message: 'Invalid user id or period' });
    }
    const { id, period } = input.params;

    try {
      return sendContract(
        res,
        contract.getTopArtists,
        await this.userService.getTopArtists(id, period),
      );
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async getTopAlbums(req: Request, res: Response) {
    const input = parseRequest(contract.getTopAlbums, req);
    if (!input) {
      return res.status(400).json({ message: 'Invalid user id or period' });
    }
    const { id, period } = input.params;

    try {
      return sendContract(
        res,
        contract.getTopAlbums,
        await this.userService.getTopAlbums(id, period),
      );
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async getTopTracks(req: Request, res: Response) {
    const input = parseRequest(contract.getTopTracks, req);
    if (!input) {
      return res.status(400).json({ message: 'Invalid user id or period' });
    }
    const { id, period } = input.params;

    try {
      return sendContract(
        res,
        contract.getTopTracks,
        await this.userService.getTopTracks(id, period),
      );
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default UserController;
