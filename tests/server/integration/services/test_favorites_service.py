import os
import unittest
from server import create_app
from server.models.dtos.favorites_dto import FavoriteDTO
from server.models.postgis.utils import NotFound
from server.services.favorite_service import FavoriteService
from tests.server.helpers.test_helpers import create_canned_project

class TestFavoriteService(unittest.TestCase):

    skip_tests = False
    test_project = None
    test_user = None

    @classmethod
    def setUpClass(cls):
        env = os.getenv('CI', 'false')

        # Firewall rules mean we can't hit Postgres from CI so we have to skip them in the CI build
        if env == 'true':
            cls.skip_tests = True

    def setUp(self):
        if self.skip_tests:
            return

        self.app = create_app()
        self.ctx = self.app.app_context()
        self.ctx.push()

        self.test_project, self.test_user = create_canned_project()

    def tearDown(self):
        if self.skip_tests:
            return

        self.test_project.delete()
        self.test_user.delete()
        self.ctx.pop()

    def test_favorite_create_delete_read(self):
        if self.skip_tests:
            return

        # Arrange
        project_id, user_id = self.test_project.id, self.test_user.id
        favorite_dto = FavoriteDTO()
        favorite_dto.project_id = project_id
        favorite_dto.user_id = user_id

        favorite_id = FavoriteService.create_favorite(favorite_dto)

        # Verify that test is not repeated.
        with self.assertRaises(ValueError):
            FavoriteService.create_favorite(favorite_dto)

        try:
            actual_favorite = FavoriteService.get_favorite_as_dto(project_id, user_id)

            # Assert PUT and GET
            self.assertEqual(actual_favorite.project_id, favorite_dto.project_id)
            self.assertEqual(actual_favorite.user_id, favorite_dto.user_id)

            FavoriteService.delete_favorite(project_id, user_id)

            with self.assertRaises(NotFound):
                FavoriteService.get_favorite_as_dto(project_id, user_id)
        except Exception:
            # If any problem occurs try and tidy up
            FavoriteService.delete_favorite(project_id, user_id)


