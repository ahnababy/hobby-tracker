import datetime
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import Habit, HabitLog
from .serializers import HabitSerializer, HabitLogSerializer, UserSerializer, RegisterSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            token, _ = Token.objects.get_or_create(user=user)

            # Seed default habits for new user
            default_habits = ["Drank Water (8 glasses)", "Read 10 pages", "30 Min Workout", "Morning Meditation"]
            today = datetime.date.today()
            start_of_week = today - datetime.timedelta(days=today.weekday())

            for habit_name in default_habits:
                habit = Habit.objects.create(name=habit_name, owner=user)
                # Seed a couple sample checked days for demo
                for day_offset in range(3):
                    log_date = start_of_week + datetime.timedelta(days=day_offset)
                    HabitLog.objects.create(habit_fk=habit, date=log_date, is_done=True)

            return Response({
                'token': token.key,
                'user': UserSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({'error': 'Please provide both username and password.'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=username, password=password)
        if not user:
            return Response({'error': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Record memory of last login timestamp
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        return Response({'message': 'Successfully logged out.'}, status=status.HTTP_200_OK)


class HabitViewSet(viewsets.ModelViewSet):
    serializer_class = HabitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Habit.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=['post'], url_path='toggle-log')
    def toggle_log(self, request):
        habit_id = request.data.get('habit_id')
        log_date = request.data.get('date')
        
        if not habit_id or not log_date:
            return Response(
                {'error': 'Both habit_id and date are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            habit = Habit.objects.get(id=habit_id, owner=request.user)
        except Habit.DoesNotExist:
            return Response({'error': 'Habit not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        log, created = HabitLog.objects.get_or_create(
            habit_fk=habit,
            date=log_date,
            defaults={'is_done': True}
        )

        if not created:
            if 'is_done' in request.data:
                log.is_done = request.data['is_done']
            else:
                log.is_done = not log.is_done
            log.save()

        return Response(HabitLogSerializer(log).data, status=status.HTTP_200_OK)
